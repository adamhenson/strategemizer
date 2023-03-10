// this file is loosely typed as it was copied from another project
import moment from 'moment-timezone';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { StrategyConfig, StartAndEnd, Strategy } from '../types';
import AlpacaClient from './AlpacaClient';
import archiveDirectory from './archiveDirectory';
import createCsv from './createCsv';
import createDirectory from './createDirectory';
import createJsonFile from './createJsonFile';
import getTradingDay from './getTradingDay';
import orderMatrixTableColumn from './orderMatrixTableColumn';
import simulateTrade from './simulateTrade';
import {
  getBarsWithRetry,
  getRandomlySortedArray,
  formatCurrencyNumber,
  sortByKey,
  delay,
} from './utils';

moment.tz.setDefault('America/New_York');

const { LOG_LEVEL = 'error' } = process.env;

let strategyConfirmedResults: any[] = [];

interface CustomComparison {
  profit: number;
  trades: number;
}
type CustomComparisonGroup = Record<string, CustomComparison>;
type CustomComparisonGroups = Record<string, CustomComparisonGroup>;
export type HandleStrategyError = (error: any) => void;
export type HandleTestStrategySymbolIndex = (index: number) => Promise<void>;

let customComparisons: CustomComparisonGroups = {};
let hours: CustomComparisonGroup = {};

let accountBudget: number;
let accountBudgetMultiplier: number;
let accountBudgetPercentPerTrade: number;
let alpacaClient: AlpacaClient;
let isFractional: boolean | undefined;
let maxLoops: number;
let maxLossPercent: number | undefined;
let handleStrategyError: HandleStrategyError | undefined;
let outputDirectory: string;
let overallEnd: string;
let overallNetProfit = 0;
let overallStart: string;
let reportDate: string;
let reportTime: string;
let shouldReturnAssetPaths: boolean;
let strategy: Strategy;
let strategyConfig: StrategyConfig;
let strategyConfigKey: string;
let strategyConfigVariationKey: string | undefined;
let strategyKey: string;
let strategyResults: any[] = [];
let strategyVersion: string;
let timeframe: string;
let totalLossTrades = 0;
let totalProfitTrades = 0;

const handleResolvedResult = async ({
  result,
  tradeAccountBudget,
}: {
  result: any;
  tradeAccountBudget: number;
}) => {
  const tradeData = await simulateTrade({
    accountBudget: tradeAccountBudget,
    accountBudgetMultiplier,
    accountBudgetPercentPerTrade,
    alpacaClient,
    isFractional,
    isShort: result.isShort,
    maxLossPercent,
    sellOnDownwardMovement: false,
    strategyResult: result,
    symbol: result.symbol,
  });

  if (!tradeData) {
    return;
  }

  const {
    entryDate,
    loss,
    lossPercent,
    points: tradeDataPoints,
    profit,
    profitPercent,
    qty,
    exitDate,
    exitPrice,
    spent,
    targetedLossPercent,
    targetedProfitPercent,
  } = tradeData;

  if (!qty) {
    return;
  }

  const points = [
    ...(!Array.isArray(result.points) ? [] : result.points),
    ...tradeDataPoints,
  ];

  const netProfit = profit > 0 ? profit : -loss;
  overallNetProfit += netProfit;

  if (loss) {
    totalLossTrades++;
  }

  if (profit) {
    totalProfitTrades++;
  }

  if (result.customComparisons && result.customComparisons.length) {
    for (const customComparison of result.customComparisons) {
      if (!customComparisons[customComparison.group]) {
        customComparisons[customComparison.group] = {};
      }
      if (!customComparisons[customComparison.group][customComparison.name]) {
        customComparisons[customComparison.group][customComparison.name] = {
          profit: 0,
          trades: 0,
        };
      }
      customComparisons[customComparison.group][customComparison.name].profit +=
        netProfit;
      customComparisons[customComparison.group][customComparison.name].trades++;
    }
  }

  const hourOfTrade = moment(result.t).hour();
  if (!hours[hourOfTrade]) {
    hours[hourOfTrade] = {
      profit: 0,
      trades: 0,
    };
  }
  hours[hourOfTrade].profit += netProfit;
  hours[hourOfTrade].trades++;

  strategyConfirmedResults.push({
    entryTime: moment(entryDate).format('YYYY-MM-DD h:mm:ss a'),
    date: moment(result.t).format('YYYY-MM-DD'),
    detectionTime: moment(result.t).format('YYYY-MM-DD h:mm:ss a'),
    ema9: result.ema9 && parseFloat(result.ema9.toFixed(2)),
    ema20: result.ema20 && parseFloat(result.ema20.toFixed(2)),
    flatLines: result.flatLines,
    formation: result.formation,
    loss,
    lossPercent,
    orderTime: moment(entryDate).diff(
      moment(result.t).add(1, 'minute'),
      'seconds',
    ),
    points,
    price: formatCurrencyNumber(result.price),
    profit,
    profitPercent,
    profitPrice: formatCurrencyNumber(result.profitPrice),
    qty,
    rvol: result.rvol,
    rsi: result.rsi,
    exitPrice,
    exitTime: moment(exitDate).format('YYYY-MM-DD h:mm:ss a'),
    spent,
    stopPrice: formatCurrencyNumber(result.stopPrice),
    symbol: result.symbol,
    t: result.t,
    targetedProfitPercent,
    targetedLossPercent,
    time: result.time,
    vwap: result.vwap,
  });

  return tradeData;
};

interface TradeBudget {
  accountBudget: number | null;
  change?: number | null;
  date: number;
  strategyId: string;
  symbol: string;
  type: string;
  wasBudgetCarriedOver?: boolean;
}

let tradeBudgets: TradeBudget[] = [
  // {
  //   accountBudget: 119423.22,
  //   change: -122.33,
  //   date: 1656707258868,
  //   strategyId: 'abcdefg',
  //   type: 'entry',
  // },
  // // `null` accountBudget values are essentially "unresolved".
  // {
  //   accountBudget: null,
  //   change: null,
  //   date: 1656707304785,,
  //   strategyId: 'abcdefg',
  //   type: 'exit',
  // },
  // // because we have an "entry" below, that will depend its budget
  // // on the outcome of the above exit - it will need to wait until
  // // the above exit "resolves"
  // {
  //   accountBudget: null,
  //   change: null,
  //   date: 1656707335025,
  //   strategyId: 'hijk',
  //   type: 'entry',
  // },
  // {
  //   accountBudget: null,
  //   change: null,
  //   date: 1656707498921,
  //   strategyId: 'hijk',
  //   type: 'exit',
  // },
];

const resolveTradeResults = async () => {
  console.log('');
  console.log(
    '??? starting trade simulation (b): final trade (prevents conflicting trade times)',
  );
  console.log('');
  for (const [index, tradeBudget] of tradeBudgets.entries()) {
    const tradeAccountBudget = !index
      ? accountBudget
      : tradeBudgets[index - 1].accountBudget;

    if (typeof tradeAccountBudget !== 'number') {
      if (LOG_LEVEL.includes('verbose')) {
        console.log('no account budget');
      }
      break;
    }

    const result = strategyResults.find(
      (current) => current.strategyId === tradeBudget.strategyId,
    );

    const relatedTradeBudgets = tradeBudgets.filter(
      (current) => current.strategyId === tradeBudget.strategyId,
    );

    if (tradeBudget.type === 'exit') {
      if (typeof tradeBudget.change === 'number') {
        tradeBudget.accountBudget = tradeAccountBudget + tradeBudget.change;
      } else {
        tradeBudget.accountBudget = tradeAccountBudget;
        tradeBudget.wasBudgetCarriedOver = true;
        if (LOG_LEVEL.includes('verbose')) {
          console.log('no exit change specified', {
            tradeBudget,
            entryBudget: relatedTradeBudgets.find(
              (current) =>
                current.strategyId === tradeBudget.strategyId &&
                current.type === 'entry',
            ),
            result,
          });
        }
      }
      continue;
    }

    const tradeData = await handleResolvedResult({
      result,
      tradeAccountBudget,
    });

    const exitTradeBudget = relatedTradeBudgets.find(
      (current) =>
        current.strategyId === tradeBudget.strategyId &&
        current.type === 'exit',
    );

    if (!tradeData) {
      tradeBudget.accountBudget = tradeAccountBudget;
      if (exitTradeBudget) {
        exitTradeBudget.change = 0;
      }
      continue;
    }

    // because this is the "entry" trade budget - we subtract what we
    // spent from the budget
    tradeBudget.accountBudget = tradeAccountBudget - tradeData.spent;

    // in the future, "exit" trade budget we add back what we spent plus
    // the profit or loss
    const change = tradeData.profit || -tradeData.loss;

    if (exitTradeBudget) {
      exitTradeBudget.change =
        tradeData.spent + change * accountBudgetMultiplier;
    }
  }
  console.log('?????? completed trade simulation (b)');
};

const handleResults = async () => {
  console.log(
    '??? starting trade simulation (a): including those with conflicting entry and exit points',
  );
  console.log('');

  strategyResults = sortByKey({
    array: strategyResults,
    key: 'tTime',
  });

  // this initial loop will give us entry and exit times
  for (const result of strategyResults) {
    const tradeData = await simulateTrade({
      accountBudget,
      accountBudgetMultiplier,
      accountBudgetPercentPerTrade,
      alpacaClient,
      isFractional,
      isShort: result.isShort,
      maxLossPercent,
      sellOnDownwardMovement: false,
      strategyResult: result,
      symbol: result.symbol,
    });

    if (!tradeData) {
      continue;
    }

    const { entryDate, qty, exitDate } = tradeData;

    if (!qty) {
      continue;
    }

    const entryDateNumber = moment(entryDate).valueOf();
    const exitDateNumber = moment(exitDate).valueOf();

    tradeBudgets.push(
      {
        accountBudget: null,
        date: entryDateNumber,
        strategyId: result.strategyId,
        symbol: result.symbol,
        type: 'entry',
      },
      {
        accountBudget: null,
        date: exitDateNumber,
        strategyId: result.strategyId,
        symbol: result.symbol,
        type: 'exit',
      },
    );
  }

  console.log('?????? completed trade simulation (a)');

  tradeBudgets = sortByKey({
    array: tradeBudgets,
    key: 'date',
  });

  await resolveTradeResults();
};

interface RunStrategyInput extends StartAndEnd {
  symbol: string;
}

const runStrategy = async ({ symbol, start, end }: RunStrategyInput) => {
  try {
    if (LOG_LEVEL.includes('verbose')) {
      console.log('unresolved total', strategyResults.length);
    }

    const bars = await getBarsWithRetry({
      alpacaClient,
      end,
      symbol,
      start,
      timeframe,
    });

    if (!bars) {
      return;
    }

    // test every bar as if it was the most recent
    for (const [index] of bars.entries()) {
      const slicedBars = bars.slice(0, index + 1);
      if (slicedBars.length) {
        const result = await strategy({
          bars: slicedBars,
          config: strategyConfig,
          symbol,
        });

        if (result) {
          strategyResults.push({
            ...result,
            strategyId: uuid(),
            symbol,
            tTime: moment(result.t).valueOf(),
          });
        }
      }
    }
  } catch (error) {
    if (handleStrategyError) {
      handleStrategyError(error);
    }
  }
};

type ResultRecord = number | string | undefined;
export interface ResultTable {
  headerRow: string[];
  dataRows: ResultRecord[][];
}
interface CustomComparisonResult {
  name: string;
  result: ResultTable;
}

export interface StrategemizerRunResult {
  assets?: string;
  config: StrategyConfig;
  customComparisons: CustomComparisonResult[];
  hours: ResultTable;
  profit: number;
  reportDate: string;
  reportTime: string;
  result: ResultTable;
  strategyConfig: string;
  strategyConfigVariation?: string;
  strategy: string;
  strategyVersion: string;
  summary: ResultTable;
}

const handleEnd = async (): Promise<StrategemizerRunResult | null> => {
  await handleResults();

  if (overallNetProfit === 0) {
    return null;
  }

  outputDirectory = path.resolve(outputDirectory);
  createDirectory(outputDirectory);

  const configFilePath = `${outputDirectory}/config.json`;
  createJsonFile({
    content: strategyConfig,
    outputPath: configFilePath,
  });
  const assets = [configFilePath];

  if (LOG_LEVEL.includes('trade-budgets')) {
    const tradeBudgetsFilePath = `${outputDirectory}/trade-budgets.json`;
    createJsonFile({
      content: tradeBudgets,
      outputPath: tradeBudgetsFilePath,
    });
    assets.push(tradeBudgetsFilePath);
  }

  // create csv files
  const reportHeaderRowList = [
    'date',
    'symbol',
    'entry',
    'exit',
    'profit',
    'profit %',
    'profit aim',
    'profit % aim',
    'stop aim',
    'loss % aim',
    'qty',
    'cost',
    'rVol',
    'rsi',
    'vwap',
    'ema9',
    'ema20',
    'ordered',
    'detected',
    'entered',
    'exited',
  ];
  const reportHeaderRow = [...reportHeaderRowList, 'link'];

  // ordered by 'profit' in descending order
  const indexOfProfit = reportHeaderRowList.indexOf('profit');
  const reportDataRows = orderMatrixTableColumn(
    strategyConfirmedResults.map((data) => {
      const points = data.points.reduce(
        (accumulator: string, current: string) =>
          `${accumulator}&points[]=${current}`,
        '',
      );
      const flatLines = (data.flatLines || []).reduce(
        (accumulator: string, current: string) =>
          `${accumulator}&flatLines[]=${current}`,
        '',
      );
      const minChartStart = moment(data.t)
        .set({
          hour: 9,
          minute: 30,
          milliseconds: 0,
          seconds: 0,
        })
        .toISOString();
      const minChartEnd = moment(data.t)
        .set({
          hour: 16,
          minute: 0,
          milliseconds: 0,
          seconds: 0,
        })
        .toISOString();

      return [
        data.date,
        data.symbol,
        data.price,
        data.exitPrice,
        data.profit || -data.loss,
        data.profitPercent || -data.lossPercent,
        data.profitPrice,
        data.targetedProfitPercent,
        data.stopPrice,
        data.targetedLossPercent,
        data.qty,
        data.spent,
        data.rvol,
        data.rsi,
        data.vwap,
        data.ema9,
        data.ema20,
        data.orderTime,
        data.detectionTime,
        data.entryTime,
        data.exitTime,
        `https://www.laservision.app/stocks/${data.symbol}?start=${minChartStart}` +
          `&end=${minChartEnd}${points}${flatLines}&timeframe=1Min`,
      ];
    }),
    indexOfProfit,
    'desc',
  );

  const reportFilePath = `${outputDirectory}/report.csv`;
  createCsv({
    content: reportDataRows,
    header: reportHeaderRow,
    outputPath: reportFilePath,
  });
  assets.push(reportFilePath);

  const summaryHeaderRow = [
    'profit',
    'profit trades',
    'loss trades',
    'highest trade profit',
    'lowest trade profit',
  ];
  const overallFormattedProfit = formatCurrencyNumber(overallNetProfit);
  const summaryDataRows = [
    [
      overallFormattedProfit,
      totalProfitTrades,
      totalLossTrades,
      reportDataRows[0][indexOfProfit],
      reportDataRows[reportDataRows.length - 1][indexOfProfit],
    ],
  ];

  const summaryFilePath = `${outputDirectory}/summary.csv`;
  createCsv({
    content: summaryDataRows,
    header: summaryHeaderRow,
    outputPath: summaryFilePath,
  });
  assets.push(summaryFilePath);

  const hoursHeaderRow = ['hour', 'profit', 'trades'];
  const hoursDataRows = Object.keys(hours).map((hour) => {
    const data = hours[hour];
    const profit = formatCurrencyNumber(data.profit);
    return [hour, profit, data.trades];
  });

  const hoursFilePath = `${outputDirectory}/hours.csv`;
  createCsv({
    content: hoursDataRows,
    header: hoursHeaderRow,
    outputPath: hoursFilePath,
  });
  assets.push(hoursFilePath);

  const customComparisonResults: CustomComparisonResult[] = [];

  if (Object.keys(customComparisons).length) {
    for (const group in customComparisons) {
      const customComparisonsHeaderRow = ['name', 'profit', 'trades'];
      const customComparisonsDataRows = Object.keys(
        customComparisons[group],
      ).map((name) => {
        const customComparison = customComparisons[group][name];
        const profit = formatCurrencyNumber(customComparison.profit);
        return [name, profit, customComparison.trades];
      });
      const customComparisonFilePath = `${outputDirectory}/custom-comparison-${group}.csv`;
      createCsv({
        content: customComparisonsDataRows,
        header: customComparisonsHeaderRow,
        outputPath: customComparisonFilePath,
      });
      assets.push(customComparisonFilePath);
      customComparisonResults.push({
        name: group,
        result: {
          headerRow: customComparisonsHeaderRow,
          dataRows: customComparisonsDataRows,
        },
      });
    }
  }

  const zippedAssets = await archiveDirectory(outputDirectory);

  console.log('');
  console.log(`?????? ${strategyConfirmedResults.length} strategy detections`);

  return {
    ...(!shouldReturnAssetPaths
      ? {}
      : {
          assets: zippedAssets,
        }),
    config: strategyConfig,
    customComparisons: customComparisonResults,
    hours: {
      headerRow: hoursHeaderRow,
      dataRows: hoursDataRows,
    },
    profit: overallFormattedProfit,
    reportDate,
    reportTime,
    result: {
      headerRow: reportHeaderRow,
      dataRows: reportDataRows,
    },
    strategy: strategyKey,
    strategyConfig: strategyConfigKey,
    strategyConfigVariation: strategyConfigVariationKey,
    strategyVersion,
    summary: {
      headerRow: summaryHeaderRow,
      dataRows: summaryDataRows,
    },
  };
};

const tradeDayStartAndEndHashMap: Record<string, StartAndEnd> = {};

const handleSymbol = async (symbol: string) => {
  console.log(
    `starting ${moment(overallStart).format('MM/DD/YYYY')} ` +
      `- ${moment(overallEnd).format('MM/DD/YYYY')}...`,
  );

  const loop = async ({ start, end }: StartAndEnd): Promise<any> => {
    const tradeDayStartAndEndHashKey = `${start}__${end}`;
    const isTradeDayTimeFromMemory =
      !!tradeDayStartAndEndHashMap[tradeDayStartAndEndHashKey];
    if (!isTradeDayTimeFromMemory) {
      tradeDayStartAndEndHashMap[tradeDayStartAndEndHashKey] =
        await getTradingDay({
          alpacaClient,
          shouldAdd: true,
          start,
          end,
        });
    }
    const validStartAndEnd =
      tradeDayStartAndEndHashMap[tradeDayStartAndEndHashKey];

    const diff = moment(overallEnd).diff(
      moment(validStartAndEnd.start),
      'minutes',
    );

    if (diff <= 0) {
      console.log('');
      console.log(`?????? completed trade data collection for ${symbol}`);
      console.log('');
      return;
    }

    console.log(
      `starting ${moment(validStartAndEnd.start).format('MM/DD/YYYY')}${
        !isTradeDayTimeFromMemory ? '' : ' (date from memory)'
      }...`,
    );

    const result: any = await runStrategy({
      start: validStartAndEnd.start,
      symbol,
      end: validStartAndEnd.end,
    });

    if (result && result.retry) {
      return loop({
        start: validStartAndEnd.start,
        end: validStartAndEnd.end,
      });
    }

    const nextTimeframe = {
      start: moment(validStartAndEnd.start).add(1, 'day').toISOString(),
      end: moment(validStartAndEnd.end).add(1, 'day').toISOString(),
    };

    return loop({
      start: nextTimeframe.start,
      end: nextTimeframe.end,
    });
  };

  const firstTimeframe = {
    start: overallStart,
    end: overallEnd,
  };

  // start at the beginning... we do one day at a time, so this
  // should be the first valid day
  await loop({
    start: firstTimeframe.start,
    end: moment(firstTimeframe.start)
      .set({
        hours: 16,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      })
      .toISOString(),
  });
};

const testStrategy = async ({
  accountBudget: accountBudgetParam,
  accountBudgetMultiplier: accountBudgetMultiplierParam,
  accountBudgetPercentPerTrade: accountBudgetPercentPerTradeParam,
  alpacaBaseUrl,
  alpacaBaseUrlData,
  alpacaApiKeyId,
  alpacaSecretKey,
  end,
  handleStrategyError: handleStrategyErrorParam,
  handleSymbolIndex,
  isFractional: isFractionalParam,
  isRandomlySorted,
  maxLoops: maxLoopsParam = Infinity,
  maxLossPercent: maxLossPercentParam,
  outputDirectory: outputDirectoryParam,
  reportDate: reportDateParam,
  reportTime: reportTimeParam,
  shouldDelayForLogs,
  shouldReturnAssetPaths: shouldReturnAssetPathsParam = true,
  start,
  strategy: strategyParam,
  strategyConfig: strategyConfigParam,
  strategyConfigKey: strategyConfigKeyParam,
  strategyConfigVariationKey: strategyConfigVariationKeyParam,
  strategyKey: strategyKeyParam,
  strategyVersion: strategyVersionParam,
  symbols,
  timeframe: timeframeParam = '1Min',
}: {
  accountBudget: number;
  accountBudgetMultiplier: number;
  accountBudgetPercentPerTrade: number;
  alpacaBaseUrl: string;
  alpacaBaseUrlData: string;
  alpacaApiKeyId: string;
  alpacaSecretKey: string;
  end: string;
  handleStrategyError?: HandleStrategyError;
  handleSymbolIndex?: HandleTestStrategySymbolIndex;
  isFractional?: boolean;
  isRandomlySorted?: boolean;
  maxLoops?: number;
  maxLossPercent?: number;
  outputDirectory: string;
  reportDate: string;
  reportTime: string;
  shouldReturnAssetPaths?: boolean;
  shouldDelayForLogs?: boolean;
  start: string;
  strategy: Strategy;
  strategyConfig: StrategyConfig;
  strategyConfigKey: string;
  strategyConfigVariationKey: string | undefined;
  strategyKey: string;
  strategyVersion: string;
  symbols: string[];
  timeframe?: string;
}): Promise<StrategemizerRunResult | null> => {
  accountBudget = accountBudgetParam;
  accountBudgetMultiplier = accountBudgetMultiplierParam;
  accountBudgetPercentPerTrade = accountBudgetPercentPerTradeParam;
  handleStrategyError = handleStrategyErrorParam;
  isFractional = isFractionalParam;
  maxLoops = maxLoopsParam;
  maxLossPercent = maxLossPercentParam;
  outputDirectory = outputDirectoryParam;
  overallEnd = end;
  overallStart = start;
  reportDate = reportDateParam;
  reportTime = reportTimeParam;
  shouldReturnAssetPaths = shouldReturnAssetPathsParam;
  strategy = strategyParam;
  strategyConfig = strategyConfigParam;
  strategyConfigKey = strategyConfigKeyParam;
  strategyConfigVariationKey = strategyConfigVariationKeyParam;
  strategyKey = strategyKeyParam;
  strategyVersion = strategyVersionParam;
  timeframe = timeframeParam;

  // reset
  customComparisons = {};
  hours = {};
  overallNetProfit = 0;
  strategyResults = [];
  totalLossTrades = 0;
  totalProfitTrades = 0;
  tradeBudgets = [];
  strategyConfirmedResults = [];

  console.log('options', {
    accountBudget,
    accountBudgetMultiplier,
    accountBudgetPercentPerTrade,
    end,
    isFractional,
    isRandomlySorted,
    LOG_LEVEL,
    maxLossPercent,
    maxLoops,
    outputDirectory,
    shouldDelayForLogs,
    shouldReturnAssetPaths,
    start,
    timeframe,
  });
  console.log('');

  // a 3 second delay to read the above in the output
  if (shouldDelayForLogs) {
    await delay(3000);
  }

  alpacaClient = new AlpacaClient(
    alpacaBaseUrl,
    alpacaBaseUrlData,
    alpacaApiKeyId,
    alpacaSecretKey,
    LOG_LEVEL.includes('verbose') && LOG_LEVEL.includes('alpaca-client'),
  );

  const symbolList = !isRandomlySorted
    ? symbols
    : getRandomlySortedArray(symbols);
  let index = 0;

  console.log('??? collecting trade data for each day for each symbol...');
  console.log('');

  while (index < symbolList.length && index < maxLoops) {
    if (handleSymbolIndex) {
      await handleSymbolIndex(index);
    }
    const symbol = symbolList[index];

    console.log(index + 1, symbol);

    const result: any = await handleSymbol(symbol);

    if (result && result.retry) {
      index--;
      continue;
    }

    index++;
  }

  console.log('');

  const runResult = await handleEnd();
  return runResult;
};

export default testStrategy;
