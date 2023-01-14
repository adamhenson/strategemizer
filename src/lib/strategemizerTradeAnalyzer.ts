import moment from 'moment-timezone';
import tradeAnalyzerStandard from '../analyzers/tradeAnalyzerStandard';
import {
  ALPACA_BASE_URL,
  ALPACA_BASE_URL_DATA,
  ALPACA_API_KEY_ID,
  ALPACA_SECRET_KEY,
} from '../config';
import { Trade } from '../types';
import AlpacaClient from './AlpacaClient';
import getPackage from './getPackage';
import logTimeElapsed from './logTimeElapsed';

moment.tz.setDefault('America/New_York');

const RETRY_MAX = 50;
const { LOG_LEVEL = 'error' } = process.env;

const getTrades = async ({
  alpacaClient,
  end,
  pageToken,
  retryCount = 0,
  start,
  symbol,
  trades = [],
}: {
  alpacaClient: AlpacaClient;
  end: string;
  pageToken?: string;
  retryCount?: number;
  start: string;
  symbol: string;
  trades?: Trade[];
}): Promise<Trade[]> => {
  console.log('getting batch of trades');
  const tradeResult = await alpacaClient.getTrades(symbol, {
    end,
    start,
    page_token: pageToken,
  });

  if (tradeResult.error) {
    console.log(`${symbol}: error fetching trades`, tradeResult.error);
    if (retryCount > RETRY_MAX) {
      console.log(
        `${symbol}: trade fetch retries maxed... giving up on trade fetch`,
      );
      return [];
    }
  }

  if (!tradeResult.trades || !tradeResult.trades.length) {
    return trades;
  }

  const updatedTrades = [...trades, ...tradeResult.trades];

  if (!tradeResult.next_page_token) {
    return updatedTrades;
  }

  return getTrades({
    alpacaClient,
    end,
    pageToken: tradeResult.next_page_token,
    retryCount,
    start,
    symbol,
    trades: updatedTrades,
  });
};

const strategemizerTradeAnalyzer = async ({
  analyzerType = 'standard',
  end,
  start,
  symbol,
}: {
  analyzerType?: string;
  end: string;
  start: string;
  symbol: string;
}) => {
  const startTime = moment();
  const packageContent = await getPackage();
  const packageContentParsed = JSON.parse(packageContent);

  console.log('-----------------------------------');
  console.log('');
  console.log(`${packageContentParsed.name}@${packageContentParsed.version}`);
  console.log('');
  console.log('-----------------------------------');
  console.log('');

  const alpacaClient = new AlpacaClient(
    ALPACA_BASE_URL,
    ALPACA_BASE_URL_DATA,
    ALPACA_API_KEY_ID,
    ALPACA_SECRET_KEY,
    LOG_LEVEL.includes('verbose') && LOG_LEVEL.includes('alpaca-client'),
  );

  const trades = await getTrades({
    alpacaClient,
    end,
    start,
    symbol,
  });

  if (analyzerType === 'standard') {
    await tradeAnalyzerStandard({
      trades,
    });
  }

  console.log('trades analyzed', trades.length);

  logTimeElapsed(startTime);
};

export default strategemizerTradeAnalyzer;
