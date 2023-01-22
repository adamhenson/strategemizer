export interface Asset {
  id: string;
  class: string;
  exchange: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  marginable: boolean;
  shortable: boolean;
  easy_to_borrow: boolean;
  fractionable: boolean;
  maintenance_margin_requirement: number;
}

export interface Bar {
  c: number;
  h: number;
  l: number;
  o: number;
  t: string;
  v: number;
}

export type CsvCellValue = string | number;
export type CsvRow = CsvCellValue[];
export type CsvRows = CsvCellValue[][];
export type CsvHeaderRow = CsvCellValue[];

export interface Trade {
  c: string[];
  i: number;
  p: number;
  s: number;
  t: string;
  x: string;
  z: string;
}

export interface BarWithExtras extends Bar {
  rvol: number;
  vwap: number;
}

export interface TechnicalIndicatorsInput {
  open: number[];
  high: number[];
  close: number[];
  low: number[];
}

export interface TechnicalIndicatorsInputWithVolume
  extends TechnicalIndicatorsInput {
  volume: number[];
}

export interface TradeTimes {
  start: string;
  end: string;
}

export interface ConfigRange {
  increment?: number;
  range: [number, number];
  type: 'range';
}
export type StrategyConfig = Record<string, ConfigRange | any>;
export type StrategyConfigs = Record<string, StrategyConfig>;

export type Strategy = (options: any) => Promise<any>;
export interface StrategyWithConfigs {
  strategy: (options: any) => Promise<any>;
  configs: StrategyConfigs;
}
export type StrategyCollection = Record<string, StrategyWithConfigs>;

export interface StartAndEnd {
  start: string;
  end: string;
}
