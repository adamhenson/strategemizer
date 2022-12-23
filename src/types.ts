export interface Bar {
  c: number;
  h: number;
  l: number;
  o: number;
  t: string;
  v: number;
}

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

export type Config = Record<string, any>;

export interface StartAndEnd {
  start: string;
  end: string;
}
