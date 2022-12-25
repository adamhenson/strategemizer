import { StrategyCollection } from '../types';
import bullishEngulfing, {
  configs as bullishEngulfingConfigs,
} from './public/bullishEngulfing';
import threeWhiteSoldiers, {
  configs as threeWhiteSoldiersConfigs,
} from './public/threeWhiteSoldiers';

// import somePrivateStrategy, {
//   configs as somePrivateStrategyConfigs,
// } from './private/somePrivateStrategy';

const strategies: StrategyCollection = {
  bullishEngulfing: {
    strategy: bullishEngulfing,
    configs: bullishEngulfingConfigs,
  },
  threeWhiteSoldiers: {
    strategy: threeWhiteSoldiers,
    configs: threeWhiteSoldiersConfigs,
  },
};

export default strategies;
