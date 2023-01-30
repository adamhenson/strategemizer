import moment from 'moment-timezone';
import path from 'path';
import barAnalyzerEndOfDay, {
  barAnalyzerSummaryEndOfDay,
  reportHeader as reportEndOfDayHeader,
  summaryHeader as summaryEndOfDayHeader,
} from '../analyzers/barAnalyzerEndOfDay';
import barAnalyzerEndOfDayTrade, {
  barAnalyzerSummaryEndOfDayTrade,
  reportHeader as reportEndOfDayTradeHeader,
  summaryHeader as summaryEndOfDayTradeHeader,
} from '../analyzers/barAnalyzerEndOfDayTrade';
import {
  ALPACA_BASE_URL,
  ALPACA_BASE_URL_DATA,
  ALPACA_API_KEY_ID,
  ALPACA_SECRET_KEY,
  MAIN_OUTPUT_DIRECTORY,
} from '../config';
import highVolumeSymbolList from '../symbols/public/highVolume';
import standardSymbolList from '../symbols/public/standard';
import todaySymbolList from '../symbols/public/today';
import { CostsByDay, CsvRows, TradeTimes } from '../types';
import AlpacaClient from './AlpacaClient';
import createCsv from './createCsv';
import createDirectory from './createDirectory';
import getPackage from './getPackage';
import logTimeElapsed from './logTimeElapsed';
import { getBarsWithRetry } from './utils';

moment.tz.setDefault('America/New_York');

const { LOG_LEVEL = 'error' } = process.env;

const strategemizerBarAnalyzer = async ({
  analyzerType = 'end-of-day',
  buyingPower = 120000,
  buyingPowerMultiplier = 4,
  end,
  start,
  symbolsKey = 'standard',
  timeframe = '1Min',
  version,
}: {
  analyzerType?: string;
  buyingPower?: number;
  buyingPowerMultiplier?: number;
  end: string;
  start: string;
  symbolsKey?: string;
  timeframe?: string;
  version: string;
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
  } else if (symbolsKey === 'high-volume') {
    symbols = highVolumeSymbolList;
  } else if (symbolsKey === 'today') {
    symbols = todaySymbolList;
  }

  let costsByDay: CostsByDay = {};
  let rows: CsvRows = [];
  let updatedBuyingPower = buyingPower;
  let tradeTimes: TradeTimes[] = [];
  for (const [index, symbol] of symbols.entries()) {
    console.log('---------');
    console.log(index, symbol);
    console.log('---------');
    console.log('');

    const bars = await getBarsWithRetry({
      alpacaClient,
      end,
      symbol,
      start,
      timeframe,
    });

    if (!bars) {
      continue;
    }

    console.log('');
    console.log('bars', bars.length);
    console.log('');

    if (analyzerType === 'end-of-day') {
      const row = await barAnalyzerEndOfDay({
        bars,
        symbol,
        timeframe,
      });
      if (row) {
        rows = [...rows, ...row];
      }
    } else if (analyzerType === 'end-of-day-trade') {
      const result = await barAnalyzerEndOfDayTrade({
        bars,
        buyingPower: updatedBuyingPower,
        buyingPowerMultiplier,
        costsByDay,
        symbol,
        tradeTimes,
      });
      if (result.rows) {
        rows = [...rows, ...result.rows];
        costsByDay = result.costsByDay;
        tradeTimes = result.tradeTimes;
        updatedBuyingPower = result.buyingPower;
      }
    }
  }

  console.log('results', rows.length);

  const outputDirectory = path.resolve(
    `${MAIN_OUTPUT_DIRECTORY}/bar-analysis/${version}/${reportDate}/${reportTime}`,
  );
  createDirectory(outputDirectory);
  createCsv({
    content: rows,
    header:
      analyzerType === 'end-of-day'
        ? reportEndOfDayHeader
        : analyzerType === 'end-of-day-trade'
        ? reportEndOfDayTradeHeader
        : [],
    outputPath: `${outputDirectory}/report.csv`,
  });

  let summaryRows: CsvRows = [];

  if (analyzerType === 'end-of-day') {
    summaryRows = barAnalyzerSummaryEndOfDay(rows);
  } else if (analyzerType === 'end-of-day-trade') {
    summaryRows = barAnalyzerSummaryEndOfDayTrade(rows);
  }

  createCsv({
    content: summaryRows,
    header:
      analyzerType === 'end-of-day'
        ? summaryEndOfDayHeader
        : analyzerType === 'end-of-day-trade'
        ? summaryEndOfDayTradeHeader
        : [],
    outputPath: `${outputDirectory}/summary.csv`,
  });

  logTimeElapsed(startTime);
};

export default strategemizerBarAnalyzer;
