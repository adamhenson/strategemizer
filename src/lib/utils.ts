import moment from 'moment-timezone';
import { EMA, RSI, Stochastic, VWAP } from 'technicalindicators';
import { TradeTimes } from '../types';
import {
  Bar,
  BarWithExtras,
  TechnicalIndicatorsInput,
  TechnicalIndicatorsInputWithVolume,
} from '../types';
import AlpacaClient from './AlpacaClient';

moment.tz.setDefault('America/New_York');

const { LOG_LEVEL = 'error' } = process.env;

export const formatCurrencyNumber = (currencyNumber: number): number =>
  parseFloat(currencyNumber.toFixed(2));

export const delay = (timeout: number) =>
  new Promise((resolve) => setTimeout(resolve, timeout));

export const getTechnicalIndicatorsInput = (
  bars: Bar[],
): TechnicalIndicatorsInput =>
  bars.reduce(
    (accumulator: TechnicalIndicatorsInput, current) =>
      !current
        ? accumulator
        : {
            open: [...accumulator.open, current.o],
            high: [...accumulator.high, current.h],
            close: [...accumulator.close, current.c],
            low: [...accumulator.low, current.l],
          },
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

export const getBarsWithRealTimeMostRecent = ({
  realTimeBar,
  bars,
}: {
  realTimeBar: Bar;
  bars: Bar[];
}) => {
  if (!realTimeBar) {
    return bars;
  }

  const mostRecentBar = bars[bars.length - 1];

  if (realTimeBar.t === mostRecentBar.t) {
    return bars;
  }

  if (moment(realTimeBar.t).diff(moment(mostRecentBar.t), 'seconds') < 0) {
    return bars;
  }

  return [...bars, realTimeBar];
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
    bars,
    period: 14,
  });
  const ema8 = getEma({
    bars,
    period: 8,
  });
  const ema9 = getEma({
    bars,
    period: 9,
  });
  const ema20 = getEma({
    bars,
    period: 20,
  });
  const ema50 = getEma({
    bars,
    period: 50,
  });
  const ema100 = getEma({
    bars,
    period: 100,
  });
  const stochastic = getStochastic({
    bars,
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
    rvol: mostRecentBar?.rvol,
    vwap: mostRecentBar?.vwap,
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

export const validateBarsResponse = async ({
  response,
  symbol,
}: {
  response: any;
  symbol: string;
}): Promise<boolean | undefined> => {
  if (response.status === 429) {
    if (LOG_LEVEL.includes('verbose')) {
      console.log(symbol, 'rate limit hit, waiting then retrying');
    }
    await delay(3000);
    return;
  } else if (response.error) {
    if (LOG_LEVEL.includes('verbose')) {
      console.log(
        symbol,
        `error fetching bars...skipping for now`,
        response.error,
      );
    }
    return false;
  } else if (!response.bars || !response.bars.length) {
    if (LOG_LEVEL.includes('extra-verbose')) {
      console.log(symbol, 'no bars found');
    }
    return false;
  }
  return true;
};

export const getBars = async ({
  alpacaClient,
  bars = [],
  end,
  limit,
  next_page_token,
  start,
  symbol,
  timeframe,
}: {
  alpacaClient: AlpacaClient;
  bars?: Bar[];
  end?: string;
  limit?: number;
  next_page_token?: string;
  start: string;
  symbol: string;
  timeframe: string;
}): Promise<Bar[] | { retry: true } | undefined> => {
  const response = await alpacaClient.getBars(symbol, {
    start,
    timeframe,
    ...(next_page_token && { page_token: next_page_token }),
    ...(end && { end }),
    ...(limit && { limit }),
  });

  let isValid: boolean | undefined = true;

  isValid = await validateBarsResponse({
    response,
    symbol,
  });

  if (!isValid) {
    if (typeof isValid === 'undefined') {
      return { retry: true };
    }
    return;
  }

  const updatedBars = [...bars, ...response.bars];

  if (response.next_page_token) {
    return getBars({
      alpacaClient,
      bars: updatedBars,
      end,
      limit,
      next_page_token: response.next_page_token,
      start,
      symbol,
      timeframe,
    });
  }

  return updatedBars;
};

export const getBarsWithRetry = async ({
  alpacaClient,
  end,
  limit,
  retryCount = 0,
  retryMax = 5,
  retryDelay = 3000,
  start,
  symbol,
  timeframe,
}: {
  alpacaClient: AlpacaClient;
  end?: string;
  limit?: number;
  retryCount?: number;
  retryMax?: number;
  retryDelay?: number;
  start: string;
  symbol: string;
  timeframe: string;
}): Promise<Bar[] | undefined> => {
  const bars = await getBars({
    alpacaClient,
    end,
    limit,
    start,
    symbol,
    timeframe,
  });

  if (!bars) {
    return;
  }

  if (!Array.isArray(bars) && bars.retry) {
    if (retryCount >= retryMax) {
      return;
    } else {
      return getBarsWithRetry({
        alpacaClient,
        end,
        limit,
        start,
        symbol,
        timeframe,
        retryCount: retryCount + 1,
        retryMax,
        retryDelay,
      });
    }
  }

  return bars as Bar[];
};

export const isWithinExistingTradeTime = (
  date: string,
  tradeTimes: TradeTimes[],
): boolean => {
  const matchingTimeframe = tradeTimes.find(
    ({ start, end }) =>
      (moment(date).isAfter(moment(start)) &&
        moment(date).isBefore(moment(end))) ||
      start === date ||
      end === date,
  );
  return !!matchingTimeframe;
};

export const sortByKey = ({
  array,
  key,
  direction = 'ascending',
}: {
  array: any[];
  key: string;
  direction?: 'ascending' | 'descending';
}) => {
  const updatedArray = [...array];
  updatedArray.sort(function (a, b) {
    const keyA = a[key];
    const keyB = b[key];

    if (direction === 'ascending') {
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
    } else {
      if (keyA < keyB) return 1;
      if (keyA > keyB) return -1;
    }
    return 0;
  });
  return updatedArray;
};

export const getQty = async ({
  alpacaClient,
  buyingPower: buyingPowerParam,
  buyingPowerNonMarginable: buyingPowerNonMarginableParam,
  isCrypto,
  isFractional,
  isShort,
  maxLossPercent = 2,
  percentOfBuyingPower = 100,
  price,
  stopPrice,
}: {
  alpacaClient?: AlpacaClient;
  buyingPower: number;
  buyingPowerNonMarginable: number;
  isCrypto?: boolean;
  isFractional?: boolean;
  isShort?: boolean;
  maxLossPercent?: number;
  percentOfBuyingPower?: number;
  price: number;
  stopPrice: number;
}): Promise<number> => {
  if (price === stopPrice) {
    return 0;
  }

  let buyingPower = buyingPowerParam;
  let buyingPowerNonMarginable = buyingPowerNonMarginableParam;

  if (typeof buyingPower !== 'number' && alpacaClient) {
    const account = await alpacaClient.getAccount();
    buyingPower = Number(account.buying_power);
    buyingPowerNonMarginable = Number(account.non_marginable_buying_power);
  }

  const adjustedBuyingPower = !isCrypto
    ? buyingPower
    : buyingPowerNonMarginable;

  if (!adjustedBuyingPower) {
    return 0;
  }

  if (!buyingPower) {
    return 0;
  }

  // `non_marginable_buying_power` is the actual money in the account
  // while `buying_power` is the "available" money (usually
  // non_marginable_buying_power * 4)
  const availableBuyingPower =
    (percentOfBuyingPower / 100) * adjustedBuyingPower;

  const availableBuyingPowerNonMarginable =
    (percentOfBuyingPower / 100) * buyingPowerNonMarginable;

  // never risk more than 2% (`maxLossPercent`)
  const riskMoney = availableBuyingPowerNonMarginable * (maxLossPercent / 100);
  const potentialLossPerShare = !isShort
    ? price - stopPrice
    : stopPrice - price;
  const allowedUnitsOfLoss = riskMoney / potentialLossPerShare;

  let qty;

  if (allowedUnitsOfLoss * price > availableBuyingPower) {
    if (isFractional) {
      qty = availableBuyingPower / price;
    } else {
      qty = Math.floor(availableBuyingPower / price);
    }
  } else if (isFractional) {
    qty = allowedUnitsOfLoss;
  } else {
    qty = Math.floor(allowedUnitsOfLoss);
  }

  return qty;
};

export function randomSort() {
  return Math.random() - 0.5;
}

// will only work with an array of primitives
type Primitive = string | boolean | number;
export const getRandomlySortedArray = <Type extends Primitive>(
  array: Type[],
): Type[] => {
  const clonedArray = [...array];
  clonedArray.sort(randomSort);
  return clonedArray;
};

// https://stackoverflow.com/a/2901298
export const numberWithCommas = (x: number): string =>
  x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const numberStringWithCommas = (x: string): string =>
  x.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
