export interface Bar {
  c: number;
  h: number;
  l: number;
  o: number;
  t: string;
  v: number;
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

export type Config = Record<string, any>;
