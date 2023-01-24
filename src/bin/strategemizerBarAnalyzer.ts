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
    version: {
      type: 'string',
      isRequired: true,
    },
  },
});

const { analyzerType, end, start, symbolsKey, timeframe, version } = cli.flags;

strategemizerBarAnalyzer({
  analyzerType,
  end,
  start,
  symbolsKey,
  timeframe,
  version,
});
