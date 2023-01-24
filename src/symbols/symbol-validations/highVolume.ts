import moment from 'moment-timezone';
import AlpacaClient, { GetLatestTradeResult } from '../../lib/AlpacaClient';
import { getBarsWithRetry } from '../../lib/utils';
import { Asset } from '../../types';

const MAX_AVG_DAILY_VOLUME = 2000000;
const MIN_AVG_DAILY_VOLUME = 1000000;
// const MIN_STOCK_PRICE = 90;
// const MAX_STOCK_PRICE = 110;
const MIN_STOCK_PRICE = 60;
const MAX_STOCK_PRICE = 400;

moment.tz.setDefault('America/New_York');

const getOneYearStart = () => {
  return moment()
    .set({
      hour: 4,
      minute: 0,
      milliseconds: 0,
      seconds: 0,
    })
    .subtract(1, 'year')
    .toISOString();
};

const highVolume = async ({
  alpacaClient,
  asset,
  maxAverageDailyVolume = MAX_AVG_DAILY_VOLUME,
  minAverageDailyVolume = MIN_AVG_DAILY_VOLUME,
  maxStockPrice = MAX_STOCK_PRICE,
  minStockPrice = MIN_STOCK_PRICE,
}: {
  alpacaClient: AlpacaClient;
  asset: Asset;
  maxAverageDailyVolume?: number;
  minAverageDailyVolume?: number;
  maxStockPrice?: number;
  minStockPrice?: number;
}): Promise<boolean> => {
  if (!asset.tradable || asset.class === 'crypto') {
    return false;
  }

  const latestTrade = (await alpacaClient.getLatestTrade(
    asset.symbol,
  )) as GetLatestTradeResult;

  if (typeof latestTrade?.trade?.p !== 'number') {
    return false;
  }

  if (latestTrade.trade.p > maxStockPrice) {
    return false;
  }

  if (latestTrade.trade.p < minStockPrice) {
    return false;
  }

  const bars1Year = await getBarsWithRetry({
    alpacaClient,
    symbol: asset.symbol,
    start: getOneYearStart(),
    timeframe: '1Day',
  });

  if (!bars1Year) {
    return false;
  }

  // checkpoint: no day bars or less than 30 for the year
  if (bars1Year.length < 30) {
    return false;
  }

  const annualTotalVolume = bars1Year.reduce(
    (accumulator, current) => accumulator + current.v,
    0,
  );
  const averageDailyVolume = annualTotalVolume / bars1Year.length;

  // checkpoint: minimum average daily volume
  if (averageDailyVolume < minAverageDailyVolume) {
    return false;
  }

  // checkpoint: maximum average daily volume
  if (averageDailyVolume > maxAverageDailyVolume) {
    return false;
  }

  return true;
};

export default highVolume;
