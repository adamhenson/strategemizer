#!/usr/bin/env node
import meow from 'meow';
import strategemizerTradeAnalyzer from '../lib/strategemizerTradeAnalyzer';

const cli = meow({
  importMeta: import.meta,
  flags: {
    end: {
      type: 'string',
      isRequired: true,
    },
    start: {
      type: 'string',
      isRequired: true,
    },
    symbol: {
      type: 'string',
      isRequired: true,
    },
  },
});

const { end, start, symbol } = cli.flags;

strategemizerTradeAnalyzer({
  end,
  start,
  symbol,
});
