import moment from 'moment-timezone';
import getQuantity from '../lib/getQuantity';
import { formatCurrencyNumber } from '../lib/utils';
import endOfDay from '../strategies/public/marketOrder/endOfDay';
import { Bar, CostsByDay, CsvRows, CsvHeaderRow, TradeTimes } from '../types';

moment.tz.setDefault('America/New_York');

const PERCENT_OF_BUYING_POWER = 95;

export const reportHeader: CsvHeaderRow = ['symbol', 'date', 'profit', 'link'];

export const summaryHeader: CsvHeaderRow = [
  'profit',
  'profit trades',
  'loss trades',
];

const barAnalyzerEndOfDayTrade = async ({
  bars,
  buyingPower,
  buyingPowerMultiplier,
  costsByDay,
  symbol,
  tradeTimes,
}: {
  bars: Bar[];
  buyingPower: number;
  buyingPowerMultiplier: number;
  costsByDay: CostsByDay;
  symbol: string;
  tradeTimes: TradeTimes[];
}): Promise<{
  buyingPower: number;
  costsByDay: CostsByDay;
  rows: CsvRows;
  tradeTimes: TradeTimes[];
}> => {
  const rows: CsvRows = [];
  let updatedCostsByDay = { ...costsByDay };
  let updatedBuyingPower = buyingPower;
  let updatedTradeTimes: TradeTimes[] = tradeTimes;

  for (const [index, bar] of bars.entries()) {
    const barMoment = moment(bar.t);
    if (barMoment.hours() !== 16) {
      continue;
    }
    if (barMoment.minutes() !== 0) {
      continue;
    }

    // // 4:52
    const endOfDayBarIndex = index - 7;
    // 4:56
    // const endOfDayBarIndex = index - 3;
    const nearEndOfDayBars = bars.slice(0, endOfDayBarIndex);
    const nearEndOfDayBar = nearEndOfDayBars[nearEndOfDayBars.length - 1];

    const endOfDayResult = endOfDay({
      bars: nearEndOfDayBars,
      symbol,
    });

    if (!endOfDayResult) {
      continue;
    }

    const tradeStartTime = nearEndOfDayBar.t;
    const tradeEndTime = bar.t;
    const tradeDate = moment(bar.t).format('YYYY-MM-DD');

    let availableBuyingPower = updatedBuyingPower;
    if (updatedCostsByDay[tradeDate]) {
      availableBuyingPower =
        availableBuyingPower - updatedCostsByDay[tradeDate];
      if (availableBuyingPower <= 0) {
        continue;
      }
    }

    const quantity = await getQuantity({
      buyingPower: availableBuyingPower,
      buyingPowerNonMarginable: availableBuyingPower / buyingPowerMultiplier,
      percentOfBuyingPower: PERCENT_OF_BUYING_POWER,
      price: endOfDayResult.price,
      stopPrice: endOfDayResult.stopPrice,
    });

    if (quantity <= 0) {
      continue;
    }

    const hypotheticalClosing =
      endOfDayResult.price > bar.c ? endOfDayResult.stopPrice : bar.c;

    const cost = quantity * endOfDayResult.price;

    if (updatedCostsByDay[tradeDate]) {
      updatedCostsByDay[tradeDate] += cost;
    } else {
      updatedCostsByDay[tradeDate] = cost;
    }

    const revenue = quantity * hypotheticalClosing;
    const profit = revenue - cost;

    updatedBuyingPower += profit;
    updatedTradeTimes.push({
      start: tradeStartTime,
      end: tradeEndTime,
    });

    const points = [nearEndOfDayBar.t, bar.t].reduce(
      (accumulator: string, current: string) =>
        `${accumulator}&points[]=${current}`,
      '',
    );
    const minChartStart = moment(nearEndOfDayBar.t)
      .set({
        hour: 9,
        minute: 30,
        milliseconds: 0,
        seconds: 0,
      })
      .toISOString();
    const minChartEnd = moment(nearEndOfDayBar.t)
      .set({
        hour: 16,
        minute: 0,
        milliseconds: 0,
        seconds: 0,
      })
      .toISOString();

    const link =
      `https://www.laservision.app/stocks/${symbol}?start=${minChartStart}` +
      `&end=${minChartEnd}${points}&timeframe=1Min`;

    rows.push([
      symbol,
      moment(bar.t).format('YYYY-MM-DD'),
      formatCurrencyNumber(profit),
      link,
    ]);
  }

  return {
    buyingPower: updatedBuyingPower,
    costsByDay: updatedCostsByDay,
    rows,
    tradeTimes: updatedTradeTimes,
  };
};

export const barAnalyzerSummaryEndOfDayTrade = (rows: CsvRows): CsvRows => {
  let totalProfit = 0;
  let lossTrades = 0;
  let profitTrades = 0;
  for (const [, , profit] of rows) {
    if (profit < 0) {
      lossTrades++;
    } else {
      profitTrades++;
    }
    totalProfit += profit as number;
  }
  return [[formatCurrencyNumber(totalProfit), profitTrades, lossTrades]];
};

export default barAnalyzerEndOfDayTrade;
