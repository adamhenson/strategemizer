#!/usr/bin/env node
import meow from 'meow';
import getSymbols from '../lib/getSymbols';

const cli = meow({
  importMeta: import.meta,
  flags: {
    maxStockPrice: {
      type: 'number',
    },
    minStockPrice: {
      type: 'number',
    },
    name: {
      isRequired: true,
      type: 'string',
    },
    type: {
      type: 'string',
    },
  },
});

const { maxStockPrice, minStockPrice, name, type } = cli.flags;

getSymbols({
  getFunction: type,
  maxStockPrice,
  minStockPrice,
  name,
});
