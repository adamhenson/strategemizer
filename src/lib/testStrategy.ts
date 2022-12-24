// this file is loosely typed as it was copied from another project
import fs from 'fs';
import moment from 'moment-timezone';
import path from 'path';
import { v4 as uuid } from 'uuid';
import strategies from '../strategies';
import symbols from '../symbols';
import { Bar, StartAndEnd } from '../types';
import AlpacaClient from './AlpacaClient';
import getTradingDay from './getTradingDay';
import simulateTrade from './simulateTrade';
import { getBarsWithRetry, formatCurrencyNumber, sortByKey } from './utils';

moment.tz.setDefault('America/New_York');

const { LOG_LEVEL = 'error' } = process.env;

const strategyConfirmedResults: any[] = [];

interface CustomComparison {
  profit: number;
  trades: number;
}
type CustomComparisonGroup = Record<string, CustomComparison>;
type CustomComparisonGroups = Record<string, CustomComparisonGroup>;

const customComparisons: CustomComparisonGroups = {};
const formations: CustomComparisonGroup = {};
const hours: CustomComparisonGroup = {};

let accountBudget: number;
let accountBudgetMultiplier: number;
let accountBudgetPercentPerTrade: number;
let alpacaClient: AlpacaClient;
let isFractional: boolean | undefined;
let maxLoops: number;
let maxLossPercent: number | undefined;
let overallEnd: string;
let overallNetProfit = 0;
let overallStart: string;
let strategy: (options: any) => any;
let strategyConfigKey: string;
let strategyKey: string;
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
    // sellOnDownwardMovement: strategyKey !== 'straightAndNarrow',
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

  const netProfit = profit || -loss;
  overallNetProfit += netProfit;

  if (loss) {
    totalLossTrades++;
  }

  if (profit) {
    totalProfitTrades++;
  }

  if (!formations[result.formation]) {
    formations[result.formation] = {
      profit: 0,
      trades: 0,
    };
  }
  formations[result.formation].profit += netProfit;
  formations[result.formation].trades++;

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

let strategyResults: any[] = [];

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
};

const handleResults = async () => {
  console.log(
    'assembling trade entry and exit points to keep a running account budget...',
  );
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

  console.log('[✔️] assembly of trade entry and exit points completed');

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
  if (LOG_LEVEL.includes('verbose')) {
    console.log('unresolved total', strategyResults.length);
  }

  const bars1Min = await getBarsWithRetry({
    alpacaClient,
    end,
    symbol,
    start,
    timeframe: '1Min',
  });

  if (!bars1Min) {
    return;
  }

  const bars5Min = await getBarsWithRetry({
    alpacaClient,
    end,
    symbol,
    start,
    timeframe: '5Min',
  });

  if (!bars5Min) {
    return;
  }

  let previousDay = 1;
  const getPreviousDayBars = async (): Promise<Bar[] | undefined> => {
    const previousDayBars = await getBarsWithRetry({
      alpacaClient,
      limit: 10000,
      timeframe: '1Min',
      start: moment(start).subtract(previousDay, 'day').toISOString(),
      end: moment(end).subtract(previousDay, 'day').toISOString(),
      symbol,
    });

    const isResultValid = previousDayBars;

    previousDay++;
    if (isResultValid) {
      return previousDayBars;
    } else if (previousDay > 5) {
      return;
    } else {
      return getPreviousDayBars();
    }
  };

  const bars1MinPreviousDay = await getPreviousDayBars();

  if (!bars1MinPreviousDay) {
    return;
  }

  // test every bar as if it was the most recent
  if (timeframe === '5Min') {
    for (const [index] of bars5Min.entries()) {
      const sliced5MinBars = bars5Min.slice(0, index + 1);
      if (sliced5MinBars.length) {
        const result = await strategy({
          bars: sliced5MinBars,
          configKey: strategyConfigKey,
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
  } else {
    for (const [index] of bars1Min.entries()) {
      const sliced1MinBars = bars1Min.slice(0, index + 1);
      if (sliced1MinBars.length) {
        const result = await strategy({
          bars: sliced1MinBars,
          configKey: strategyConfigKey,
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
  }
};

const handleEnd = async () => {
  await handleResults();

  const reportDay = moment().format('YYYY-MM-DD');
  const reportTime = moment().format('h-mm-ss-a');
  const outputDirectory = `./output/${strategyKey}_v${strategyVersion}/${reportDay}/${reportTime}`;
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  if (LOG_LEVEL.includes('trade-budgets')) {
    fs.writeFileSync(
      `${outputDirectory}/trade-budgets.json`,
      JSON.stringify(tradeBudgets, null, 2),
    );
  }

  // create csv files
  const csvHeaderList = [
    'date',
    'symbol',
    'entry price',
    'exit price',
    'profit',
    'profit percent',
    'targeted profit price',
    'targeted profit percent',
    'targeted stop price',
    'targeted loss percent',
    'qty',
    'cost',
    'rVol',
    'rsi',
    'vwap',
    'ema9',
    'ema20',
    'order time',
    'detection time',
    'entry time',
    'exit time',
  ];
  const csvHeader = [...csvHeaderList, 'link'].join(',') + '\n';
  const csvContent = strategyConfirmedResults
    .map((data) => {
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
      ].join(',');
    })
    .join('\n');
  const outputCsv = path.resolve(`${outputDirectory}/report.csv`);
  fs.writeFileSync(outputCsv, `${csvHeader}${csvContent}`);

  const csvSummaryHeader =
    ['profit', 'total profit trades', 'total loss trades'].join(',') + '\n';

  const overallProfit = formatCurrencyNumber(overallNetProfit);
  const csvSummaryContent =
    [overallProfit, totalProfitTrades, totalLossTrades].join(',') + '\n';
  const outputSummaryCsv = path.resolve(`${outputDirectory}/summary.csv`);
  fs.writeFileSync(outputSummaryCsv, `${csvSummaryHeader}${csvSummaryContent}`);

  const csvFormationsHeader = ['name', 'profit', 'trades'].join(',') + '\n';

  const csvFormationsContent = Object.keys(formations)
    .map((name) => {
      const formation = formations[name];
      const profit = formatCurrencyNumber(formation.profit);
      return [name, profit, formation.trades].join(',');
    })
    .join('\n');
  const outputFormationsCsv = path.resolve(`${outputDirectory}/formations.csv`);
  fs.writeFileSync(
    outputFormationsCsv,
    `${csvFormationsHeader}${csvFormationsContent}`,
  );

  const csvHoursHeader = ['hour', 'profit', 'trades'].join(',') + '\n';

  const csvHoursContent = Object.keys(hours)
    .map((hour) => {
      const data = hours[hour];
      const profit = formatCurrencyNumber(data.profit);
      return [hour, profit, data.trades].join(',');
    })
    .join('\n');
  const outputHoursCsv = path.resolve(`${outputDirectory}/hours.csv`);
  fs.writeFileSync(outputHoursCsv, `${csvHoursHeader}${csvHoursContent}`);

  if (Object.keys(customComparisons).length) {
    for (const group in customComparisons) {
      const csvCustomComparisonsHeader =
        ['name', 'profit', 'trades'].join(',') + '\n';

      const csvCustomComparisonsContent = Object.keys(customComparisons[group])
        .map((name) => {
          const customComparison = customComparisons[group][name];
          const profit = formatCurrencyNumber(customComparison.profit);
          return [name, profit, customComparison.trades].join(',');
        })
        .join('\n');
      const outputCustomComparisonsCsv = path.resolve(
        `${outputDirectory}/custom-comparison-${group}.csv`,
      );
      fs.writeFileSync(
        outputCustomComparisonsCsv,
        `${csvCustomComparisonsHeader}${csvCustomComparisonsContent}`,
      );
    }
  }

  console.log(
    `✔️ ${strategyConfirmedResults.length} strategy confirmed points`,
  );
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
      console.log(`✔️ completed`);
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
  isFractional: isFractionalParam,
  maxLoops: maxLoopsParam = Infinity,
  maxLossPercent: maxLossPercentParam,
  start,
  strategyConfigKey: strategyConfigKeyParam,
  strategyKey: strategyKeyParam,
  strategyVersion: strategyVersionParam = '1',
  symbolsKey,
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
  isFractional?: boolean;
  maxLoops?: number;
  maxLossPercent?: number;
  start: string;
  strategyConfigKey: string;
  strategyKey: string;
  strategyVersion?: string;
  symbolsKey: string;
  timeframe?: string;
}) => {
  accountBudget = accountBudgetParam;
  accountBudgetMultiplier = accountBudgetMultiplierParam;
  accountBudgetPercentPerTrade = accountBudgetPercentPerTradeParam;
  isFractional = isFractionalParam;
  maxLoops = maxLoopsParam;
  maxLossPercent = maxLossPercentParam;
  overallEnd = end;
  overallStart = start;
  strategyConfigKey = strategyConfigKeyParam;
  strategyKey = strategyKeyParam;
  strategyVersion = strategyVersionParam;
  timeframe = timeframeParam;

  strategy = strategies[strategyKey];

  console.log('testStrategy payload', {
    accountBudget,
    accountBudgetMultiplier,
    accountBudgetPercentPerTrade,
    end,
    isFractional,
    maxLossPercent,
    maxLoops,
    start,
    strategyConfigKey,
    strategyKey,
    strategyVersion,
    symbolsKey,
    timeframe,
  });

  alpacaClient = new AlpacaClient(
    alpacaBaseUrl,
    alpacaBaseUrlData,
    alpacaApiKeyId,
    alpacaSecretKey,
    LOG_LEVEL.includes('verbose') && LOG_LEVEL.includes('alpaca-client'),
  );

  const symbolList = symbols[symbolsKey];
  let index = 0;

  while (index < symbolList.length && index < maxLoops - 1) {
    const symbol = symbolList[index];

    if (LOG_LEVEL.includes('verbose')) {
      console.log(index, symbol);
    }

    const result: any = await handleSymbol(symbol);

    if (result && result.retry) {
      index--;
      continue;
    }

    index++;
  }

  await handleEnd();
};

export default testStrategy;
