#!/usr/bin/env node
import meow from 'meow';
import {
  ALPACA_BASE_URL,
  ALPACA_BASE_URL_DATA,
  ALPACA_API_KEY_ID,
  ALPACA_SECRET_KEY,
} from '../config';
import testStrategy from '../lib/testStrategy';

const cli = meow({
  importMeta: import.meta,
  flags: {
    accountBudget: {
      type: 'number',
    },
    accountBudgetMultiplier: {
      type: 'number',
    },
    accountBudgetPercentPerTrade: {
      type: 'number',
    },
    end: {
      type: 'string',
      isRequired: true,
    },
    isFractional: {
      type: 'boolean',
    },
    maxLoops: {
      type: 'number',
    },
    maxLossPercent: {
      type: 'number',
    },
    start: {
      type: 'string',
      isRequired: true,
    },
    strategyConfigKey: {
      type: 'string',
      isRequired: true,
    },
    strategyKey: {
      type: 'string',
      isRequired: true,
    },
    strategyVersion: {
      type: 'string',
    },
    symbolsKey: {
      type: 'string',
      isRequired: true,
    },
    timeframe: {
      type: 'string',
    },
  },
});

const {
  accountBudget,
  accountBudgetMultiplier,
  accountBudgetPercentPerTrade,
  end,
  isFractional,
  maxLoops,
  maxLossPercent,
  start,
  strategyConfigKey,
  strategyKey,
  strategyVersion,
  symbolsKey,
  timeframe,
} = cli.flags;

const strategemizer = async () => {
  await testStrategy({
    accountBudget: accountBudget || 120000,
    accountBudgetMultiplier: accountBudgetMultiplier || 4,
    accountBudgetPercentPerTrade: accountBudgetPercentPerTrade || 100,
    alpacaBaseUrl: ALPACA_BASE_URL,
    alpacaBaseUrlData: ALPACA_BASE_URL_DATA,
    alpacaApiKeyId: ALPACA_API_KEY_ID,
    alpacaSecretKey: ALPACA_SECRET_KEY,
    end,
    isFractional,
    maxLoops,
    maxLossPercent,
    start,
    strategyConfigKey,
    strategyKey,
    strategyVersion,
    symbolsKey,
    timeframe,
  });
};

strategemizer();
