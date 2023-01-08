import moment from 'moment-timezone';
import path from 'path';
import {
  ALPACA_BASE_URL,
  ALPACA_BASE_URL_DATA,
  ALPACA_API_KEY_ID,
  ALPACA_SECRET_KEY,
  MAIN_OUTPUT_DIRECTORY,
} from '../config';
import { StrategyConfig, Strategy } from '../types';
import createDirectory from './createDirectory';
import createJsonFile from './createJsonFile';
import getConfigVariations from './getConfigVariations';
import getPackage from './getPackage';
import testStrategy, {
  HandleStrategyError,
  HandleTestStrategySymbolIndex,
  StrategemizerRunResult,
} from './testStrategy';
import { delay, numberStringWithCommas, sortByKey } from './utils';

moment.tz.setDefault('America/New_York');

export interface StrategyResult {
  profit: number;
  variation: number | string | undefined;
  assets?: string;
  result?: string;
}

export type LooseNumber = number | undefined;

export interface StrategemizerGroupIdentifierParams {
  reportDate: string;
  reportTime: string;
  strategy: string;
  strategyConfig: string;
  strategyVersion: string;
}

export interface StrategemizerGroupBase {
  reportDate: string;
  reportTime: string;
  strategy: string;
  strategyConfig: string;
  strategyVersion: string;
  variationsRanCount: number;
  variationsWithResultsCount: number;
}

export interface StrategemizerGroupUpdates extends StrategemizerGroupBase {
  largestProfit: LooseNumber;
  largestLoss: LooseNumber;
  losses: StrategyResult[];
  profits: StrategyResult[];
}

export interface StrategemizerGroupRunStartData extends StrategemizerGroupBase {
  params: Partial<StrategemizerOptions>;
  symbolCount: number;
  variationCount: number;
}

export interface StrategemizerGroupRunResult extends StrategemizerGroupBase {
  largestProfit: LooseNumber;
  largestLoss: LooseNumber;
  params: Partial<StrategemizerOptions>;
  timeElapsed: string;
  timeAtCompletion: string;
  losses: StrategyResult[];
  profits: StrategyResult[];
  summaryFilePath?: string;
  variationCount: number;
}

export interface HandleRunResultData {
  result: StrategemizerRunResult | null;
  groupUpdates: StrategemizerGroupUpdates;
}

export interface HandleSymbolIndexParams
  extends StrategemizerGroupIdentifierParams {
  symbolIndex: number;
}

export type HandleSymbolIndex = (
  data: HandleSymbolIndexParams,
) => Promise<void>;

export interface StrategemizerOptions {
  accountBudget?: number;
  accountBudgetMultiplier?: number;
  accountBudgetPercentPerTrade?: number;
  end: string;
  handleResult?: (result: HandleRunResultData) => Promise<void>;
  handleStart?: (result: StrategemizerGroupRunStartData) => Promise<void>;
  handleStrategyError?: HandleStrategyError;
  handleSymbolIndex?: HandleSymbolIndex;
  isFractional?: boolean;
  isRandomlySorted?: boolean;
  mainOutputDirectory?: string;
  maxLoops?: number;
  maxLossPercent?: number;
  shouldReturnAssetPaths?: boolean;
  shouldDelayForLogs?: boolean;
  start: string;
  strategy: Strategy;
  strategyConfig: StrategyConfig;
  strategyConfigKey: string;
  strategyKey: string;
  strategyVersion?: string;
  symbols: string[];
  timeframe?: string;
}

const strategemizer = async ({
  accountBudget = 120000,
  accountBudgetMultiplier = 4,
  accountBudgetPercentPerTrade = 100,
  end,
  handleResult,
  handleStart,
  handleStrategyError,
  handleSymbolIndex,
  isFractional,
  isRandomlySorted,
  mainOutputDirectory = MAIN_OUTPUT_DIRECTORY,
  maxLoops,
  maxLossPercent,
  shouldDelayForLogs,
  shouldReturnAssetPaths,
  start,
  strategy,
  strategyConfig,
  strategyConfigKey,
  strategyKey,
  strategyVersion = '1',
  symbols,
  timeframe,
}: StrategemizerOptions): Promise<StrategemizerGroupRunResult> => {
  const reportDate = moment().format('YYYY-MM-DD');
  const reportTime = moment().format('h-mm-ss-a');
  const startTime = moment();
  const strategyConfigVariations = getConfigVariations(strategyConfig);
  const configVariationLength = strategyConfigVariations.length;
  let lossResults: StrategyResult[] = [];
  let profitResults: StrategyResult[] = [];

  const packageContent = await getPackage();
  const packageContentParsed = JSON.parse(packageContent);

  console.log('-----------------------------------');
  console.log('');
  console.log(`${packageContentParsed.name}@${packageContentParsed.version}`);
  console.log('');
  console.log('-----------------------------------');
  console.log('');
  console.log('◉ running with', configVariationLength, 'config variations');

  const outputDirectoryBase = `${mainOutputDirectory}/${strategyKey}/v_${strategyVersion}/config_${strategyConfigKey}/${reportDate}/${reportTime}`;

  let variationsWithResultsCount = 0;
  let variationsRanCount = 0;

  const paramsBase = {
    start,
    end,
    accountBudget,
    accountBudgetMultiplier,
    accountBudgetPercentPerTrade,
    isFractional,
    isRandomlySorted,
    maxLoops,
    maxLossPercent,
    timeframe,
  };

  const params = {
    ...paramsBase,
    strategyConfigKey,
    strategyKey,
    strategyVersion,
  };

  if (handleStart) {
    await handleStart({
      params: paramsBase,
      reportDate,
      reportTime,
      strategy: strategyKey,
      strategyConfig: strategyConfigKey,
      strategyVersion: strategyVersion,
      symbolCount: maxLoops || symbols.length,
      variationCount: configVariationLength,
      variationsRanCount: 0,
      variationsWithResultsCount: 0,
    });
  }

  for (const strategyConfigVariation of strategyConfigVariations) {
    variationsRanCount++;
    console.log(
      '◉ running variation',
      strategyConfigVariation.variation,
      'of',
      configVariationLength,
    );
    console.log('');
    console.log('config', strategyConfigVariation);
    console.log('');

    if (shouldDelayForLogs) {
      await delay(3000);
    }

    const runVariation = async (
      currentVariationConfig: StrategyConfig,
      currentStart: string,
    ): Promise<number> => {
      const variationString = `/variation_${currentVariationConfig.variation}`;
      const outputDirectory = `${outputDirectoryBase}${variationString}`;

      let handleSymbolIndexInternal: HandleTestStrategySymbolIndex | undefined;
      if (handleSymbolIndex) {
        handleSymbolIndexInternal = async (index) => {
          return handleSymbolIndex({
            reportDate,
            reportTime,
            strategy: strategyKey,
            strategyConfig: strategyConfigKey,
            strategyVersion: strategyVersion,
            symbolIndex: index,
          });
        };
      }

      const result = await testStrategy({
        accountBudget,
        accountBudgetMultiplier,
        accountBudgetPercentPerTrade,
        alpacaBaseUrl: ALPACA_BASE_URL,
        alpacaBaseUrlData: ALPACA_BASE_URL_DATA,
        alpacaApiKeyId: ALPACA_API_KEY_ID,
        alpacaSecretKey: ALPACA_SECRET_KEY,
        end,
        handleStrategyError,
        handleSymbolIndex: handleSymbolIndexInternal,
        isFractional,
        isRandomlySorted,
        maxLoops,
        maxLossPercent,
        outputDirectory,
        reportDate,
        reportTime,
        shouldReturnAssetPaths,
        shouldDelayForLogs,
        start: currentStart,
        strategy,
        strategyConfig: currentVariationConfig,
        strategyConfigKey,
        strategyConfigVariationKey: currentVariationConfig.variation,
        strategyVersion,
        strategyKey,
        symbols,
        timeframe,
      });

      if (!result) {
        console.log('');
        console.log('-----------------------------------');
        console.log(`0️⃣  no results`);
        console.log('-----------------------------------');
        console.log('');
      } else {
        variationsWithResultsCount++;

        const absoluteProfit = Math.abs(result.profit);
        const formattedProfit = numberStringWithCommas(`${absoluteProfit}`);

        console.log('');
        console.log('-----------------------------------');

        if (result.profit < 0) {
          console.log(`❌ -$${formattedProfit} (total loss)`);
        } else {
          console.log(`✅ $${formattedProfit} (total profit)`);
        }

        console.log('-----------------------------------');
        console.log('');

        // a 3 second delay to read the above in the output
        if (shouldDelayForLogs) {
          await delay(3000);
        }

        const assetPath = path.resolve(`${outputDirectory}.zip`);

        const runResultItemBase = {
          ...(!shouldReturnAssetPaths
            ? {}
            : {
                assets: assetPath,
              }),
          profit: result.profit,
          variation: currentVariationConfig.variation,
        };

        if (result.profit < 0) {
          lossResults.push({
            ...runResultItemBase,
            result: `-$${formattedProfit}`,
          });
        } else {
          profitResults.push({
            ...runResultItemBase,
            result: `$${formattedProfit}`,
          });
        }

        // sort to see best and worst first
        lossResults = sortByKey({
          array: lossResults,
          direction: 'ascending',
          key: 'profit',
        });
        profitResults = sortByKey({
          array: profitResults,
          direction: 'descending',
          key: 'profit',
        });
      }

      if (handleResult) {
        await handleResult({
          result,
          groupUpdates: {
            largestProfit: !profitResults.length
              ? undefined
              : profitResults[0].profit,
            largestLoss: !lossResults.length
              ? undefined
              : lossResults[0].profit,
            losses: lossResults,
            reportDate,
            reportTime,
            strategy: strategyKey,
            strategyConfig: strategyConfigKey,
            strategyVersion: strategyVersion,
            profits: profitResults,
            variationsRanCount,
            variationsWithResultsCount,
          },
        });
      }

      return result?.profit || 0;
    };

    const runProfit = await runVariation(strategyConfigVariation, start);

    // if the run was successful... try a year
    if (runProfit > 0) {
      await runVariation(
        {
          ...strategyConfigVariation,
          variation: `${strategyConfigVariation.variation}_year`,
        },
        moment(start).subtract(1, 'year').toISOString(),
      );
    }
  }

  console.log('generating overall report...');

  if (profitResults.length) {
    console.log('');
    console.log('-----------------------------------');
    console.log(`✅ config variations with profit`);
    console.log('-----------------------------------');
    console.log('');
    for (const profitResult of profitResults) {
      console.log(
        `  • variation ${profitResult.variation}: ${profitResult.result}`,
      );
    }
  }
  if (lossResults.length) {
    console.log('');
    console.log('-----------------------------------');
    console.log(`❌ config variations with loss`);
    console.log('-----------------------------------');
    console.log('');
    for (const lossResult of lossResults) {
      console.log(
        `  • variation ${lossResult.variation}: ${lossResult.result}`,
      );
    }
    console.log('');
  }

  const endTime = moment();
  const diffDays = endTime.diff(startTime, 'days');
  const diffHours = endTime.diff(startTime, 'hours');
  const diffMinutes = endTime.diff(startTime, 'minutes');
  const diffSeconds = endTime.diff(startTime, 'seconds');
  let timeElapsed: string;
  if (diffDays > 0) {
    const unitText = diffDays === 1 ? 'day' : 'days';
    timeElapsed = `${diffDays.toFixed(2)} ${unitText}`;
  } else if (diffHours > 0) {
    const unitText = diffHours === 1 ? 'hour' : 'hours';
    timeElapsed = `${diffHours.toFixed(2)} ${unitText}`;
  } else if (diffMinutes > 0) {
    const unitText = diffMinutes === 1 ? 'minute' : 'minutes';
    timeElapsed = `${diffMinutes} ${unitText}`;
  } else {
    const unitText = diffSeconds === 1 ? 'second' : 'seconds';
    timeElapsed = `${diffSeconds} ${unitText}`;
  }

  const timeAtCompletion = moment().format('hh:mma, MM/DD/YYYY');
  console.log(`✔️ completed in ${timeElapsed} at ${timeAtCompletion} EST`);

  createDirectory(outputDirectoryBase);
  const summaryFilePath = path.resolve(`${outputDirectoryBase}/summary.json`);

  createJsonFile({
    content: {
      largestProfit: !profitResults.length
        ? undefined
        : profitResults[0].result,
      largestLoss: !lossResults.length ? undefined : lossResults[0].result,
      timeElapsed,
      timeAtCompletion,
      params,
      profitResults,
      lossResults,
    },
    outputPath: summaryFilePath,
  });

  return {
    largestProfit: !profitResults.length ? undefined : profitResults[0].profit,
    largestLoss: !lossResults.length ? undefined : lossResults[0].profit,
    timeElapsed,
    timeAtCompletion,
    params: paramsBase,
    profits: profitResults,
    losses: lossResults,
    reportDate,
    reportTime,
    strategy: strategyKey,
    strategyConfig: strategyConfigKey,
    strategyVersion: strategyVersion,
    ...(!shouldReturnAssetPaths
      ? {}
      : {
          assets: summaryFilePath,
        }),
    variationCount: configVariationLength,
    variationsRanCount,
    variationsWithResultsCount,
  };
};

export default strategemizer;
