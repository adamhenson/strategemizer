import { default as bullishEngulfing } from './public/bullishEngulfing';

type Strategies = Record<string, (options: any) => Promise<any>>;
const strategies: Strategies = {
  bullishEngulfing,
};

export default strategies;
