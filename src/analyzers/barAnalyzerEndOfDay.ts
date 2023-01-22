import moment from 'moment-timezone';
import {
  formatCurrencyNumber,
  getIndicators,
  getPercentChange,
} from '../lib/utils';
import { Bar, CsvRows, CsvHeaderRow } from '../types';

moment.tz.setDefault('America/New_York');

const MIN_PERCENT_CHANGE = 0.4;

export const reportHeader: CsvHeaderRow = [
  'symbol',
  'date',
  'green 1st 3',
  'percent change',
  'percent change of 1st 3',
  'rvol 1',
  'rvol 2',
  'rvol 3',
  'link',
];

export const summaryHeader: CsvHeaderRow = [
  'percent green 1st 3',
  'avg percent change of 1st 3',
  'avg rvol 1',
  'avg rvol 2',
  'avg rvol 3',
];

const barAnalyzerEndOfDay = async ({
  bars,
  symbol,
  timeframe,
}: {
  bars: Bar[];
  symbol: string;
  timeframe: string;
}): Promise<CsvRows> => {
  const rows: CsvRows = [];
  for (const [index, bar] of bars.entries()) {
    const barMoment = moment(bar.t);
    if (barMoment.hours() !== 16) {
      continue;
    }
    if (barMoment.minutes() !== 0) {
      continue;
    }

    // last 10 minutes of bars
    const endOfDayBars = bars.slice(index - 10, index + 1);
    const firstBar = endOfDayBars[0];
    const secondBar = endOfDayBars[1];
    const thirdBar = endOfDayBars[2];
    const lastBar = endOfDayBars[endOfDayBars.length - 1];

    const percentChange = getPercentChange(firstBar.o, lastBar.c);

    if (percentChange < MIN_PERCENT_CHANGE) {
      continue;
    }

    const points = [firstBar.t, lastBar.t].reduce(
      (accumulator: string, current: string) =>
        `${accumulator}&points[]=${current}`,
      '',
    );
    const minChartStart = moment(firstBar.t)
      .set({
        hour: 9,
        minute: 30,
        milliseconds: 0,
        seconds: 0,
      })
      .toISOString();
    const minChartEnd = moment(firstBar.t)
      .set({
        hour: 16,
        minute: 0,
        milliseconds: 0,
        seconds: 0,
      })
      .toISOString();

    const link =
      `https://www.laservision.app/stocks/${symbol}?start=${minChartStart}` +
      `&end=${minChartEnd}${points}&timeframe=${timeframe}`;

    const isFirstThreeGreen =
      firstBar.o < firstBar.c &&
      secondBar.o < secondBar.c &&
      thirdBar.o < thirdBar.c;

    const percentChangeFirst3 = getPercentChange(firstBar.o, thirdBar.c);

    const { barsWithExtras } = getIndicators({
      bars,
    });
    const slicedBarsWithExtras = barsWithExtras.slice(index - 10, index + 1);

    const rvol1 = slicedBarsWithExtras[0].rvol;
    const rvol2 = slicedBarsWithExtras[1].rvol;
    const rvol3 = slicedBarsWithExtras[2].rvol;

    rows.push([
      symbol,
      moment(endOfDayBars[0].t).format('YYYY-MM-DD'),
      isFirstThreeGreen ? 'true' : 'false',
      formatCurrencyNumber(percentChange),
      formatCurrencyNumber(percentChangeFirst3),
      rvol1,
      rvol2,
      rvol3,
      link,
    ]);
  }

  return rows;
};

export const barAnalyzerSummaryEndOfDay = (rowOfRows: CsvRows): CsvRows => {
  let totalIsFirstThreeGreen = 0;
  let totalPercentChangeOf1st3 = 0;
  let totalRvol1 = 0;
  let totalRvol2 = 0;
  let totalRvol3 = 0;
  for (const rows of rowOfRows) {
    if (rows[2] === 'true') {
      totalIsFirstThreeGreen++;
    }
    totalPercentChangeOf1st3 += rows[4] as number;
    totalRvol1 += rows[5] as number;
    totalRvol2 += rows[6] as number;
    totalRvol3 += rows[7] as number;
  }
  return [
    [
      formatCurrencyNumber((totalIsFirstThreeGreen / rowOfRows.length) * 100),
      formatCurrencyNumber(totalPercentChangeOf1st3 / rowOfRows.length),
      formatCurrencyNumber(totalRvol1 / rowOfRows.length),
      formatCurrencyNumber(totalRvol2 / rowOfRows.length),
      formatCurrencyNumber(totalRvol3 / rowOfRows.length),
    ],
  ];
};

export default barAnalyzerEndOfDay;
