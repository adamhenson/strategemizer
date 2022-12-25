#!/usr/bin/env node
import meow from 'meow';
import strategemizer from '../lib/strategemizer';

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
    isRandomlySorted: {
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

strategemizer(cli.flags);
