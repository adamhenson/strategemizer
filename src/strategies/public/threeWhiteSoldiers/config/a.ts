import { Config } from '../../../../types';

const config: Config = {
  lossPercent: {
    type: 'range',
    increment: 0.1,
    range: [0.1, 0.3],
  },
  minPercentRise: {
    type: 'range',
    increment: 0.1,
    range: [0, 0.3],
  },
  profitPercent: {
    type: 'range',
    increment: 0.1,
    range: [0.1, 0.3],
  },
  reversalDropBarCount: 10,
  reversalDropPercentMin: {
    type: 'range',
    increment: 0.1,
    range: [0, 0.3],
  },
  shouldUseTrailPercent: {
    type: 'or',
    or: [true, false],
  },
};

export default config;
