import moment from 'moment-timezone';
import path from 'path';
import barAnalyzerEndOfDay, {
  barAnalyzerSummaryEndOfDay,
  reportHeader as reportEndOfDayHeader,
  summaryHeader as summaryEndOfDayHeader,
} from '../analyzers/barAnalyzerEndOfDay';
import {
  ALPACA_BASE_URL,
  ALPACA_BASE_URL_DATA,
  ALPACA_API_KEY_ID,
  ALPACA_SECRET_KEY,
  MAIN_OUTPUT_DIRECTORY,
} from '../config';
import standardSymbolList from '../symbols/public/standard';
import { CsvRows } from '../types';
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
  end,
  start,
  symbolsKey = 'standard',
  timeframe = '1Min',
}: {
  analyzerType?: string;
  end: string;
  start: string;
  symbolsKey?: string;
  timeframe?: string;
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

  let rows: CsvRows = [];

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
      return;
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
    }
  }

  console.log('results', rows.length);

  const outputDirectory = path.resolve(
    `${MAIN_OUTPUT_DIRECTORY}/bar-analysis/${reportDate}/${reportTime}`,
  );
  createDirectory(outputDirectory);
  createCsv({
    content: rows,
    header: analyzerType !== 'end-of-day' ? [] : reportEndOfDayHeader,
    outputPath: `${outputDirectory}/report.csv`,
  });

  let summaryRows: CsvRows = [];

  if (analyzerType === 'end-of-day') {
    summaryRows = barAnalyzerSummaryEndOfDay(rows);
  }

  createCsv({
    content: summaryRows,
    header: analyzerType !== 'end-of-day' ? [] : summaryEndOfDayHeader,
    outputPath: `${outputDirectory}/summary.csv`,
  });

  logTimeElapsed(startTime);
};

export default strategemizerBarAnalyzer;
