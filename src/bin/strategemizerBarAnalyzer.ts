#!/usr/bin/env node
import meow from 'meow';
import strategemizerBarAnalyzer from '../lib/strategemizerBarAnalyzer';

const cli = meow({
  importMeta: import.meta,
  flags: {
    analyzerType: {
      type: 'string',
    },
    end: {
      type: 'string',
      isRequired: true,
    },
    start: {
      type: 'string',
      isRequired: true,
    },
    symbolsKey: {
      type: 'string',
    },
    timeframe: {
      type: 'string',
    },
  },
});

const { analyzerType, end, start, symbolsKey, timeframe } = cli.flags;

strategemizerBarAnalyzer({
  analyzerType,
  end,
  start,
  symbolsKey,
  timeframe,
});
