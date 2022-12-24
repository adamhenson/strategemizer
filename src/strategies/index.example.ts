import { StrategyCollection } from '../types';
import bullishEngulfing, {
  configs as bullishEngulfingConfigs,
} from './public/bullishEngulfing';

const strategies: StrategyCollection = {
  bullishEngulfing: {
    strategy: bullishEngulfing,
    configs: bullishEngulfingConfigs,
  },
};

export default strategies;
