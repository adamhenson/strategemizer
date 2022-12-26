import { StrategyConfig } from '../../../../types';

const config: StrategyConfig = {
  isClosingHighest: false,
  lossPercent: 0.2,
  minRvol: {
    type: 'or',
    or: [0, 2.5],
  },
  profitPercent: 0.2,
  reversalDropBarCount: 10,
  reversalDropPercentMin: 0.1,
  shouldUseTrailPercent: false,
};

export default config;
