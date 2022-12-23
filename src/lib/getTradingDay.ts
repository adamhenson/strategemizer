import moment from 'moment-timezone';
import { StartAndEnd } from '../types';
import AlpacaClient from './AlpacaClient';
import { delay } from './utils';

moment.tz.setDefault('America/New_York');

const { LOG_LEVEL = 'error' } = process.env;

const shouldLog = LOG_LEVEL.includes('get-trading-day');

const getTradingDay = async ({
  alpacaClient,
  end: endParam,
  maxRetries = 11,
  retries = 0,
  shouldAdd,
  start: startParam,
}: {
  alpacaClient: AlpacaClient;
  end: string;
  maxRetries?: number;
  retries?: number;
  shouldAdd?: boolean;
  start: string;
}): Promise<StartAndEnd> => {
  const start = moment(startParam).toISOString();
  const end = moment(endParam).toISOString();

  const calendar = await alpacaClient.getCalendar({
    start,
    end,
  });

  if (calendar.status === 429) {
    if (retries < maxRetries) {
      if (LOG_LEVEL.includes('verbose')) {
        console.log('calendar rate limit hit, waiting then retrying');
      }
      await delay(60000);
      return getTradingDay({
        alpacaClient,
        retries: retries + 1,
        shouldAdd,
        start,
        end,
      });
    } else {
      throw Error('calendar retries maxed');
    }
  }

  if (calendar && calendar.error) {
    throw Error(calendar.error);
  }

  if (!calendar || !calendar.length) {
    console.log({
      calendar,
      start,
      end,
    });
    throw Error('no calendar found');
  }

  const calendarDate = moment(startParam).format('YYYY-MM-DD');
  for (const calendarItem of calendar) {
    if (calendarItem.date === calendarDate) {
      if (LOG_LEVEL.includes('verbose') && shouldLog) {
        console.log('[✔️] calendar date found', { start, end });
      }
      return { start, end };
    }
  }

  // if we made it here, we have no matching trading calendar dates
  let nextStart;
  let nextEnd;

  if (!shouldAdd) {
    nextStart = moment(start).subtract(1, 'day').toISOString();
    nextEnd = moment(end).subtract(1, 'day').toISOString();
  } else {
    nextStart = moment(start).add(1, 'day').toISOString();
    nextEnd = moment(end).add(1, 'day').toISOString();
  }

  if (LOG_LEVEL.includes('verbose') && shouldLog) {
    console.log(`[x] couldn't find a calendar date. trying next...`, {
      start: nextStart,
      end: nextEnd,
    });
  }

  return getTradingDay({
    alpacaClient,
    shouldAdd,
    start: nextStart,
    end: nextEnd,
  });
};

export default getTradingDay;
