import moment from 'moment-timezone';
import { bullishengulfingpattern } from 'technicalindicators';
import { Bar } from '../../../types';
import {
  formatCurrencyNumber,
  formattedLog,
  getCustomComparisonName,
  getIndicators,
  getPercentChange,
  getTechnicalIndicatorsInput,
} from '../../../utils';
import configs from './config';

moment.tz.setDefault('America/New_York');

const { LOG_LEVEL = 'error' } = process.env;
const name = 'bullish-engulfing';
const shouldLog = LOG_LEVEL.includes(name);

const bullishEngulfing = async ({
  bars,
  configName,
  symbol,
}: {
  bars: Bar[];
  configName: string;
  symbol: string;
}) => {
  const config = configs[configName];
  if (!bars?.length) {
    return;
  }

  if (bars.length < 2) {
    return;
  }

  const testSlice = bars.slice(bars.length - 2);

  if (!bullishengulfingpattern(getTechnicalIndicatorsInput(testSlice))) {
    return;
  }

  const mostRecentBar = bars[bars.length - 1];

  const percentRise = getPercentChange(mostRecentBar.o, mostRecentBar.c);

  if (
    typeof config.minPercentRise === 'number' &&
    percentRise < config.minPercentRise
  ) {
    if (shouldLog) {
      formattedLog({
        isBad: true,
        message: 'min percent rise not met',
        name,
        symbol,
      });
    }
    return;
  }

  const indicators = getIndicators({
    bars,
  });

  if (
    typeof config.minRvol === 'number' &&
    (!indicators.rvol || indicators.rvol < config.minRvol)
  ) {
    return;
  }

  if (
    typeof config.maxRsi === 'number' &&
    config.maxRsi &&
    (!indicators.rsi || indicators.rsi > config.maxRsi)
  ) {
    return;
  }

  let reversalDropPercent;
  const reversalIndex = bars.length - 3;
  const reversalBar = bars[reversalIndex];
  if (
    config.reversalDropBarCount === 'number' &&
    typeof config.reversalDropPercentMin === 'number'
  ) {
    const dropStartBar = bars[bars.length - config.reversalDropBarCount - 2];
    if (!dropStartBar) {
      if (shouldLog) {
        formattedLog({
          isBad: true,
          message: 'insufficient number of bars for reversal drop comparison',
          name,
          symbol,
        });
      }
      return;
    }
    if (dropStartBar.o <= reversalBar.c) {
      if (shouldLog) {
        formattedLog({
          isBad: true,
          message: 'not a reversal',
          name,
          symbol,
        });
      }
      return;
    }

    reversalDropPercent = getPercentChange(reversalBar.c, dropStartBar.o);

    if (
      config.reversalDropPercentMin &&
      reversalDropPercent < config.reversalDropPercentMin
    ) {
      if (shouldLog) {
        formattedLog({
          isBad: true,
          message: 'min reversal drop percent not met',
          name,
          symbol,
        });
      }
      return;
    }
  }

  const profitPercent: number = config.profitPercent;
  const lossPercent: number = config.lossPercent;

  const points = [mostRecentBar.t];
  const price = formatCurrencyNumber(mostRecentBar.c);
  const profitPrice = formatCurrencyNumber(
    price * (profitPercent / 100) + price,
  );
  const stopPrice = formatCurrencyNumber(price - price * (lossPercent / 100));
  const entryTime = moment(mostRecentBar.t).format('YYYY-MM-DD h:mm:ss a');

  const trailPercent = !config.shouldUseTrailPercent
    ? undefined
    : (stopPrice / price) * 100;

  // custom comparisons
  const percentRiseName = 'percent-rise';
  const customComparisonPercentRise = getCustomComparisonName({
    increment: 0.1,
    name: percentRiseName,
    range: [0, 4],
    value: percentRise,
  });

  const rsiName = 'rsi';
  const customComparisonRsi = getCustomComparisonName({
    increment: 20,
    name: rsiName,
    range: [0, 100],
    value: indicators.rsi,
  });

  const rvolName = 'rvol';
  const customComparisonRvol = getCustomComparisonName({
    increment: 0.5,
    name: rvolName,
    range: [0, 10],
    value: indicators.rvol,
  });

  const reversalDropName = 'reversal-drop-percent';
  const customComparisonReversalDropPercent = getCustomComparisonName({
    increment: 0.5,
    name: reversalDropName,
    range: [0, 4],
    value: reversalDropPercent,
  });

  const customComparisons = [
    { group: percentRiseName, name: customComparisonPercentRise },
    { group: rsiName, name: customComparisonRsi },
    { group: rvolName, name: customComparisonRvol },
    {
      group: reversalDropName,
      name: customComparisonReversalDropPercent,
    },
  ];

  return {
    ...indicators,
    customComparisons,
    entryTime,
    name,
    points,
    price,
    profitPrice,
    stopPrice,
    trailPercent,
  };
};

export default bullishEngulfing;
