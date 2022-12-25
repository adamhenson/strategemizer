import {
  ALPACA_BASE_URL,
  ALPACA_BASE_URL_DATA,
  ALPACA_API_KEY_ID,
  ALPACA_SECRET_KEY,
} from '../config';
import strategies from '../strategies';
import symbols from '../symbols';
import getConfigVariations from './getConfigVariations';
import testStrategy from './testStrategy';
import { delay, numberStringWithCommas } from './utils';

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
  strategyConfigKey,
  strategyKey,
  strategyVersion,
  symbolsKey,
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
  strategyConfigKey: string;
  strategyKey: string;
  strategyVersion?: string;
  symbolsKey: string;
  timeframe?: string;
}): Promise<{ losses: StrategyResult[]; profits: StrategyResult[] }> => {
  const { strategy, configs } = strategies[strategyKey];
  const strategyConfig = configs[strategyConfigKey];
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
      symbols: symbols[symbolsKey],
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
      console.log('');
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

  return { losses: lossResults, profits: profitResults };
};

export default strategemizer;
