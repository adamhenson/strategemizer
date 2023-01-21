import moment from 'moment-timezone';
import path from 'path';
import tradeAnalyzerBouncy from '../analyzers/tradeAnalyzerBouncy';
import tradeAnalyzerStandard from '../analyzers/tradeAnalyzerStandard';
import {
  ALPACA_BASE_URL,
  ALPACA_BASE_URL_DATA,
  ALPACA_API_KEY_ID,
  ALPACA_SECRET_KEY,
  MAIN_OUTPUT_DIRECTORY,
} from '../config';
import standardSymbolList from '../symbols/public/standard';
import { CsvRows, Trade } from '../types';
import AlpacaClient from './AlpacaClient';
import createCsv from './createCsv';
import createDirectory from './createDirectory';
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
  buyingPower,
  end,
  start,
  symbolsKey = 'standard',
}: {
  analyzerType?: string;
  buyingPower?: number;
  end: string;
  start: string;
  symbolsKey?: string;
}) => {
  const startTime = moment();
  const reportDate = moment().format('YYYY-MM-DD');
  const reportTime = moment().format('h-mm-ss-a');
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

  let symbols: string[] = [];
  if (symbolsKey === 'standard') {
    symbols = standardSymbolList;
  }

  const headerRowsBouncy = [
    'symbol',
    'profit',
    'profit trades',
    'loss trades',
    'avg minutes before profit',
    'avg loss perc',
  ];
  const contentRowsBouncy: CsvRows = [];

  for (const [index, symbol] of symbols.entries()) {
    console.log('---------');
    console.log(index, symbol);
    console.log('---------');
    console.log('');
    const trades = await getTrades({
      alpacaClient,
      end,
      start,
      symbol,
    });
    console.log('');
    console.log('trades', trades.length);
    console.log('');

    if (analyzerType === 'standard') {
      await tradeAnalyzerStandard({
        trades,
      });
    } else if (analyzerType === 'bouncy') {
      const result = await tradeAnalyzerBouncy({ buyingPower, trades });
      if (result) {
        console.log({
          symbol,
          profit: result.profit,
          profitTrades: result.profitTrades,
          lossTrades: result.lossTrades,
          averageMinutesBeforeProfitTrade:
            result.averageMinutesBeforeProfitTrade,
          avearageLossPercent: result.avearageLossPercent,
        });
        contentRowsBouncy.push([
          symbol,
          result.profit,
          result.profitTrades,
          result.lossTrades,
          result.averageMinutesBeforeProfitTrade,
          result.avearageLossPercent,
        ]);
      }
    }
  }

  if (analyzerType === 'bouncy') {
    const outputDirectory = path.resolve(
      `${MAIN_OUTPUT_DIRECTORY}/trade-analysis/${reportDate}/${reportTime}`,
    );
    createDirectory(outputDirectory);
    createCsv({
      content: contentRowsBouncy,
      header: headerRowsBouncy,
      outputPath: `${outputDirectory}/report.csv`,
    });
  }

  logTimeElapsed(startTime);
};

export default strategemizerTradeAnalyzer;
