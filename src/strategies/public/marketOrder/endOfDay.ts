import moment from 'moment-timezone';
import {
  formattedLog,
  formatCurrencyNumber,
  getIndicators,
  getPercentChange,
} from '../../../lib/utils';
import { Bar } from '../../../types';

moment.tz.setDefault('America/New_York');

const { LOG_LEVEL = 'error' } = process.env;
const LOSS_PERCENT = 0.1;
const MIN_PERCENT_CHANGE = 0.1;
const MIN_RVOL = 2;
const MIN_BODY_PERCENT = 70;
const MIN_PERCENT_CHANGE_MOST_RECENT = MIN_PERCENT_CHANGE / 2;

const name = 'end-of-day';
const shouldLog = LOG_LEVEL.includes(name);

const endOfDay = ({
  bars,
  symbol,
}: {
  bars: Bar[];
  symbol: string;
}): { price: number; stopPrice: number } | undefined => {
  if (!bars?.length) {
    return;
  }

  const mostRecentBar = bars[bars.length - 1];

  if (
    moment(mostRecentBar.t).hours() !== 15 ||
    moment(mostRecentBar.t).minutes() !== 52
  ) {
    return;
  }

  // the most recent bar should be moving up from the opening bar
  if (mostRecentBar.c < bars[0].o) {
    return;
  }

  // the most recent bar should be moving up
  if (mostRecentBar.c < mostRecentBar.o) {
    return;
  }

  // most recent bar should have a pretty strong, long, full body
  const mostRecentFullBarSize = mostRecentBar.h - mostRecentBar.l;
  const mostRecentBarBodySize = mostRecentBar.c - mostRecentBar.o;
  const mostRecentBodyPercent =
    (mostRecentBarBodySize / mostRecentFullBarSize) * 100;
  if (mostRecentBodyPercent < MIN_BODY_PERCENT) {
    if (shouldLog) {
      formattedLog({
        isBad: true,
        message: 'min body percent not met',
        name,
        symbol,
      });
    }
    return;
  }
  const percentChangeLastBar = getPercentChange(
    mostRecentBar.o,
    mostRecentBar.c,
  );
  if (percentChangeLastBar < MIN_PERCENT_CHANGE_MOST_RECENT) {
    if (shouldLog) {
      formattedLog({
        isBad: true,
        message: 'min percent change last bar not met',
        name,
        symbol,
      });
    }
    return;
  }

  const thirdMostRecentBar = bars[bars.length - 3];
  const percentChangeLast = getPercentChange(
    thirdMostRecentBar.o,
    mostRecentBar.c,
  );

  if (percentChangeLast < MIN_PERCENT_CHANGE) {
    if (shouldLog) {
      formattedLog({
        isBad: true,
        message: 'min percent change not met',
        name,
        symbol,
      });
    }
    return;
  }

  const { barsWithExtras } = getIndicators({
    bars,
  });

  const rvol1 = barsWithExtras[barsWithExtras.length - 3].rvol;
  const rvol2 = barsWithExtras[barsWithExtras.length - 2].rvol;
  const rvol3 = barsWithExtras[barsWithExtras.length - 1].rvol;

  if (rvol1 < MIN_RVOL) {
    if (shouldLog) {
      formattedLog({
        isBad: true,
        message: 'rvol1 min not met',
        name,
        symbol,
      });
    }
    return;
  }

  if (rvol2 < MIN_RVOL) {
    if (shouldLog) {
      formattedLog({
        isBad: true,
        message: 'rvol2 min not met',
        name,
        symbol,
      });
    }
    return;
  }

  if (rvol3 < MIN_RVOL) {
    if (shouldLog) {
      formattedLog({
        isBad: true,
        message: 'rvol3 min not met',
        name,
        symbol,
      });
    }
    return;
  }

  const stopPrice = formatCurrencyNumber(
    mostRecentBar.c - mostRecentBar.c * (LOSS_PERCENT / 100),
  );
  return { price: mostRecentBar.c, stopPrice };
};

export default endOfDay;
