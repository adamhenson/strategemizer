import * as utils from './lib/utils';

export {
  HandleStrategyError,
  ResultTable,
  StrategemizerRunResult,
} from './lib/testStrategy';
export { default as emailByTemplate } from './lib/emailByTemplate';
export { default as ErrorHandler } from './lib/ErrorHandler';
export {
  default,
  HandleRunResultData,
  HandleSymbolIndex,
  LooseNumber,
  StrategemizerOptions,
  StrategemizerGroupRunResult,
  StrategemizerGroupRunStartData,
  StrategyResult,
} from './lib/strategemizer';
export {
  Bar,
  BarWithExtras,
  Trade,
  Strategy,
  StrategyCollection,
  StrategyConfig,
  StrategyConfigs,
} from './types';
export { utils };
