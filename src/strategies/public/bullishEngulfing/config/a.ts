import { Config } from '../../../../types';

const config: Config = {
  isClosingHighest: {
    type: 'range',
    increment: 0,
    range: [true, false],
  },
  lossPercent: {
    type: 'range',
    increment: 0.1,
    range: [0.1, 0.3],
  },
  // maxRsi,
  // minPercentRise,
  // minRvol,
  profitPercent: {
    type: 'range',
    increment: 0.1,
    range: [0.1, 0.3],
  },
  reversalDropBarCount: 10,
  reversalDropPercentMin: {
    type: 'range',
    increment: 0.1,
    range: [0.1, 0.3],
  },
  shouldUseTrailPercent: {
    type: 'range',
    increment: 0,
    range: [true, false],
  },
};

export default config;
