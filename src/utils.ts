import { EMA, RSI, Stochastic, VWAP } from 'technicalindicators';
import {
  Bar,
  BarWithExtras,
  TechnicalIndicatorsInput,
  TechnicalIndicatorsInputWithVolume,
} from './types';

export const formatCurrencyNumber = (currencyNumber: number): number =>
  parseFloat(currencyNumber.toFixed(2));

export const getTechnicalIndicatorsInput = (
  bars: Bar[],
): TechnicalIndicatorsInput =>
  bars.reduce(
    (accumulator: TechnicalIndicatorsInput, current) => ({
      open: [...accumulator.open, current.o],
      high: [...accumulator.high, current.h],
      close: [...accumulator.close, current.c],
      low: [...accumulator.low, current.l],
    }),
    {
      open: [],
      high: [],
      close: [],
      low: [],
    },
  );

export const getPercentChange = (
  first: number,
  last: number,
  options?: { percentOf?: number },
): number => {
  const diff = last - first;
  const percentOf = options?.percentOf || last;
  return (diff / percentOf) * 100;
};

export const formattedLog = ({
  isBad,
  message,
  name,
  symbol,
}: {
  isBad?: boolean;
  message: string;
  name: string;
  symbol: string;
}) =>
  console.log(`   - [${!isBad ? '✔️' : 'x'}][${name}][${symbol}] ${message}`);

// https://stockstotrade.com/relative-volume/
// Relative Volume or RVol
export const getRvol = ({
  averageVolume,
  currentVolume,
}: {
  averageVolume: number;
  currentVolume: number;
}): number => {
  return formatCurrencyNumber(currentVolume / averageVolume);
};

export const getEma = ({
  bars,
  period,
}: {
  bars: Bar[];
  period: number;
}): number | undefined => {
  const emaData = EMA.calculate({
    values: bars.map((bar) => bar.c),
    period,
  });

  if (!emaData) {
    return;
  }

  return emaData[emaData.length - 1];
};

export const getEmaData = ({
  bars,
  period,
}: {
  bars: Bar[];
  period: number;
}): number[] => {
  const emaData = EMA.calculate({
    values: bars.map((bar) => bar.c),
    period,
  });
  return emaData;
};

export const getRsi = ({
  bars,
  period,
}: {
  bars: Bar[];
  period: number;
}): number | undefined => {
  const rsiData = RSI.calculate({
    values: bars.map((bar) => bar.c),
    period,
  });

  if (!rsiData) {
    return;
  }

  return rsiData[rsiData.length - 1];
};

export const getStochastic = ({
  bars,
  period = 14,
  signalPeriod = 3,
}: {
  bars: Bar[];
  period?: number;
  signalPeriod?: number;
}) => {
  const barData = getTechnicalIndicatorsInput(bars);
  return Stochastic.calculate({
    ...barData,
    period: period,
    signalPeriod: signalPeriod,
  });
};

export const getBarsWithExtras = (bars: Bar[]): BarWithExtras[] => {
  const inputVwap: TechnicalIndicatorsInputWithVolume = {
    close: [],
    high: [],
    low: [],
    open: [],
    volume: [],
  };

  let totalVolume = 0;
  let index = 0;
  const rvol: number[] = [];

  for (const bar of bars) {
    totalVolume += bar.v;
    const averageVolume = totalVolume / (index + 1);
    rvol.push(getRvol({ currentVolume: bar.v, averageVolume }));

    inputVwap.close.push(bar.c);
    inputVwap.high.push(bar.h);
    inputVwap.low.push(bar.l);
    inputVwap.open.push(bar.o);
    inputVwap.volume.push(bar.v);

    index++;
  }

  return VWAP.calculate(inputVwap).map((current, index) => ({
    c: bars[index].c,
    h: bars[index].h,
    l: bars[index].l,
    o: bars[index].o,
    rvol: rvol[index],
    t: bars[index].t,
    v: bars[index].v,
    vwap: formatCurrencyNumber(current),
  }));
};

export const getIndicators = ({
  bars,
  indicatorBarIndex,
  stochasticPeriod,
  stochasticSignalPeriod,
}: {
  bars: Bar[];
  indicatorBarIndex?: number;
  stochasticPeriod?: number;
  stochasticSignalPeriod?: number;
}) => {
  const barsExtras = getBarsWithExtras(bars);

  const rsi = getRsi({
    bars: barsExtras,
    period: 14,
  });
  const ema8 = getEma({
    bars: barsExtras,
    period: 8,
  });
  const ema9 = getEma({
    bars: barsExtras,
    period: 9,
  });
  const ema20 = getEma({
    bars: barsExtras,
    period: 20,
  });
  const ema50 = getEma({
    bars: barsExtras,
    period: 50,
  });
  const ema100 = getEma({
    bars: barsExtras,
    period: 100,
  });
  const stochastic = getStochastic({
    bars: barsExtras,
    period: stochasticPeriod,
    signalPeriod: stochasticSignalPeriod,
  });
  const mostRecentBar = barsExtras[indicatorBarIndex || barsExtras.length - 1];
  return {
    barsWithExtras: barsExtras,
    ema8,
    ema9,
    ema20,
    ema50,
    ema100,
    rsi,
    stochastic,
    rvol: mostRecentBar.rvol,
    vwap: mostRecentBar.vwap,
  };
};

export const getCustomComparisonName = ({
  increment,
  name,
  range,
  value,
}: {
  increment: number;
  name: string;
  range: [number, number];
  value?: number;
}): string => {
  if (typeof value !== 'number') {
    return `${name}_not_a_number`;
  }

  let currentIncrement = Number(range[0]);
  if (value < currentIncrement) {
    return `${name}_${range[0]}-`;
  }

  while (currentIncrement < range[1]) {
    const previousIncrement = Number(currentIncrement);
    currentIncrement += increment;
    if (value <= currentIncrement) {
      return `${name}_${previousIncrement}_${currentIncrement}`;
    }
  }

  return `${name}_${range[1]}+`;
};
