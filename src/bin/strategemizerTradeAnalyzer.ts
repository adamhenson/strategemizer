#!/usr/bin/env node
import meow from 'meow';
import strategemizerTradeAnalyzer from '../lib/strategemizerTradeAnalyzer';

const cli = meow({
  importMeta: import.meta,
  flags: {
    analyzerType: {
      type: 'string',
    },
    buyingPower: {
      type: 'number',
    },
    end: {
      type: 'string',
      isRequired: true,
    },
    start: {
      type: 'string',
      isRequired: true,
    },
    symbolListKey: {
      type: 'string',
    },
  },
});

const { analyzerType, buyingPower, end, start, symbolListKey } = cli.flags;

strategemizerTradeAnalyzer({
  analyzerType,
  buyingPower,
  end,
  start,
  symbolListKey,
});
