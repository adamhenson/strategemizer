import moment from 'moment-timezone';
import path from 'path';
import {
  ALPACA_BASE_URL,
  ALPACA_BASE_URL_DATA,
  ALPACA_API_KEY_ID,
  ALPACA_SECRET_KEY,
  MAIN_OUTPUT_DIRECTORY,
} from '../config';
import { Config, Strategy } from '../types';
import createJsonFile from './createJsonFile';
import getConfigVariations from './getConfigVariations';
import testStrategy, { StrategemizerRunResult } from './testStrategy';
import { delay, numberStringWithCommas, sortByKey } from './utils';

moment.tz.setDefault('America/New_York');

export { StrategemizerRunResult };

export interface StrategyResult {
  result: string;
  variation: number;
}

export type StrategemizerResult = Promise<{
  losses: StrategyResult[];
  profits: StrategyResult[];
}>;

export interface StrategemizerOptions {
  accountBudget?: number;
  accountBudgetMultiplier?: number;
  accountBudgetPercentPerTrade?: number;
  end: string;
  handleResult?: (result: StrategemizerRunResult) => void;
  isFractional?: boolean;
  isRandomlySorted?: boolean;
  mainOutputDirectory?: string;
  maxLoops?: number;
  maxLossPercent?: number;
  start: string;
  strategy: Strategy;
  strategyConfig: Config;
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
  isFractional,
  isRandomlySorted,
  mainOutputDirectory = MAIN_OUTPUT_DIRECTORY,
  maxLoops,
  maxLossPercent,
  start,
  strategy,
  strategyConfig,
  strategyConfigKey,
  strategyKey,
  strategyVersion = '1',
  symbols,
  timeframe,
}: StrategemizerOptions): Promise<{
  losses: StrategyResult[];
  profits: StrategyResult[];
}> => {
  const reportDay = moment().format('YYYY-MM-DD');
  const reportTime = moment().format('h-mm-ss-a');
  const startTime = moment();
  const strategyConfigVariations = getConfigVariations(strategyConfig);
  const configVariationLength = strategyConfigVariations.length;
  const hasVariations = configVariationLength > 1;
  let lossResults = [];
  let profitResults = [];

  if (hasVariations) {
    console.log('');
    console.log('running with config variations', configVariationLength);
    console.log('');
  }

  const outputDirectoryBase = `${mainOutputDirectory}/${strategyKey}_v${strategyVersion}_config_${strategyConfigKey}/${reportDay}/${reportTime}`;

  for (const strategyConfigVariation of strategyConfigVariations) {
    if (hasVariations) {
      console.log('');
      console.log(
        'running variation',
        strategyConfigVariation.variation,
        'of',
        configVariationLength,
      );
      console.log('');
      console.log('config', strategyConfigVariation);
      console.log('');
      await delay(3000);
    }

    const variationString = !hasVariations
      ? ''
      : `/variation_${strategyConfigVariation.variation}`;
    const outputDirectory = `${outputDirectoryBase}${variationString}`;

    const result = await testStrategy({
      accountBudget,
      accountBudgetMultiplier,
      accountBudgetPercentPerTrade,
      alpacaBaseUrl: ALPACA_BASE_URL,
      alpacaBaseUrlData: ALPACA_BASE_URL_DATA,
      alpacaApiKeyId: ALPACA_API_KEY_ID,
      alpacaSecretKey: ALPACA_SECRET_KEY,
      end,
      isFractional,
      isRandomlySorted,
      maxLoops,
      maxLossPercent,
      outputDirectory,
      start,
      strategy,
      strategyConfig: strategyConfigVariation,
      symbols,
      timeframe,
    });

    if (handleResult) {
      handleResult(result);
    }

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
    await delay(3000);

    const summaryPath = path.resolve(`${outputDirectory}/summary.csv`);
    if (result.profit < 0) {
      lossResults.push({
        summary: summaryPath,
        profit: result.profit,
        variation: strategyConfigVariation.variation,
        result: `-$${formattedProfit}`,
      });
    } else {
      profitResults.push({
        summary: summaryPath,
        profit: result.profit,
        variation: strategyConfigVariation.variation,
        result: `$${formattedProfit}`,
      });
    }
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

  console.log('generating overall report...');

  if (hasVariations) {
    if (profitResults.length) {
      console.log('');
      console.log('-------------------------------');
      console.log(`✅ config variations with profit`);
      console.log('-------------------------------');
      console.log('');
      for (const profitResult of profitResults) {
        console.log(
          `  • variation ${profitResult.variation}: ${profitResult.result}`,
        );
      }
    }
    if (lossResults.length) {
      console.log('');
      console.log('-------------------------------');
      console.log(`❌ config variations with loss`);
      console.log('-------------------------------');
      console.log('');
      for (const lossResult of lossResults) {
        console.log(
          `  • variation ${lossResult.variation}: ${lossResult.result}`,
        );
      }
      console.log('');
    }
  }

  const endTime = moment();
  const diffDays = endTime.diff(startTime, 'days');
  const diffHours = endTime.diff(startTime, 'hours');
  const diffMinutes = endTime.diff(startTime, 'minutes');
  const diffSeconds = endTime.diff(startTime, 'seconds');
  let completionTime: string;
  if (diffDays > 0) {
    const unitText = diffDays === 1 ? 'day' : 'days';
    completionTime = `${diffDays.toFixed(2)} ${unitText}`;
  } else if (diffHours > 0) {
    const unitText = diffHours === 1 ? 'hour' : 'hours';
    completionTime = `${diffHours.toFixed(2)} ${unitText}`;
  } else if (diffMinutes > 0) {
    const unitText = diffMinutes === 1 ? 'minute' : 'minutes';
    completionTime = `${diffMinutes} ${unitText}`;
  } else {
    const unitText = diffSeconds === 1 ? 'second' : 'seconds';
    completionTime = `${diffSeconds} ${unitText}`;
  }

  const time = moment().format('hh:mma, MM/DD/YYYY');
  console.log(`✔️ completed in ${completionTime} at ${time} EST`);

  createJsonFile({
    content: {
      largestProfit: !profitResults.length ? null : profitResults[0].result,
      largestLoss: !lossResults.length ? null : lossResults[0].result,
      completionTime,
      time,
      params: {
        start,
        end,
        accountBudget,
        accountBudgetMultiplier,
        accountBudgetPercentPerTrade,
        isFractional,
        isRandomlySorted,
        maxLoops,
        maxLossPercent,
        strategyConfigKey,
        strategyKey,
        strategyVersion,
        timeframe,
      },
      profitResults: profitResults.map((result) => ({
        result: result.result,
        variation: result.variation,
        summary: result.summary,
      })),
      lossResults: lossResults.map((result) => ({
        result: result.result,
        variation: result.variation,
        summary: result.summary,
      })),
    },
    directory: outputDirectoryBase,
    filename: 'summary.json',
  });

  return { losses: lossResults, profits: profitResults };
};

export default strategemizer;
