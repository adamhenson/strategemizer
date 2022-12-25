import moment from 'moment-timezone';
import {
  ALPACA_BASE_URL,
  ALPACA_BASE_URL_DATA,
  ALPACA_API_KEY_ID,
  ALPACA_SECRET_KEY,
} from '../config';
import { Config, Strategy } from '../types';
import getConfigVariations from './getConfigVariations';
import testStrategy from './testStrategy';
import { delay, numberStringWithCommas } from './utils';

moment.tz.setDefault('America/New_York');

interface StrategyResult {
  result: string;
  variation: number;
}

const strategemizer = async ({
  accountBudget = 120000,
  accountBudgetMultiplier = 4,
  accountBudgetPercentPerTrade = 100,
  end,
  isFractional,
  isRandomlySorted,
  maxLoops,
  maxLossPercent,
  start,
  strategy,
  strategyConfig,
  strategyConfigKey,
  strategyKey,
  strategyVersion,
  symbols,
  timeframe,
}: {
  accountBudget?: number;
  accountBudgetMultiplier?: number;
  accountBudgetPercentPerTrade?: number;
  end: string;
  isFractional?: boolean;
  isRandomlySorted?: boolean;
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
}): Promise<{ losses: StrategyResult[]; profits: StrategyResult[] }> => {
  const startTime = moment();
  const strategyConfigVariations = getConfigVariations(strategyConfig);
  const lossResults = [];
  const profitResults = [];
  const configVariationLength = strategyConfigVariations.length;
  const hasVariations = configVariationLength > 1;

  if (hasVariations) {
    console.log('');
    console.log('running with config variations', configVariationLength);
    console.log('');
  }

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

    const profit = await testStrategy({
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
      start,
      strategy,
      strategyConfig: strategyConfigVariation,
      strategyConfigKey,
      strategyConfigVariation: strategyConfigVariation.variation,
      strategyKey,
      strategyVersion,
      symbols,
      timeframe,
    });

    const absoluteProfit = Math.abs(profit);
    const formattedProfit = numberStringWithCommas(`${absoluteProfit}`);

    console.log('');
    console.log('-----------------------------------');

    if (profit < 0) {
      console.log(`❌ - $${formattedProfit} (total loss)`);
    } else {
      console.log(`✅ $${formattedProfit} (total profit)`);
    }

    console.log('-----------------------------------');
    console.log('');

    // a 3 second delay to read the above in the output
    await delay(3000);

    if (hasVariations) {
      if (profit < 0) {
        lossResults.push({
          variation: strategyConfigVariation.variation,
          result: `- $${formattedProfit}`,
        });
      } else {
        profitResults.push({
          variation: strategyConfigVariation.variation,
          result: `$${formattedProfit}`,
        });
      }
    }
  }

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
  if (diffDays > 0) {
    console.log(`✔️ completed in ${diffDays.toFixed(2)} days`);
  } else if (diffHours > 0) {
    console.log(`✔️ completed in ${diffHours.toFixed(2)} hours`);
  } else if (diffMinutes > 0) {
    console.log(`✔️ completed in ${diffMinutes.toFixed(2)} minutes`);
  } else {
    console.log(`✔️ completed in ${diffSeconds} seconds`);
  }

  return { losses: lossResults, profits: profitResults };
};

export default strategemizer;
