import moment from 'moment-timezone';
import getQuantity from '../lib/getQuantity';
import { formatCurrencyNumber, isWithinExistingTradeTime } from '../lib/utils';
import endOfDay from '../strategies/public/marketOrder/endOfDay';
import { Bar, CsvRows, CsvHeaderRow, TradeTimes } from '../types';

moment.tz.setDefault('America/New_York');

const PERCENT_OF_BUYING_POWER = 95;

export const reportHeader: CsvHeaderRow = ['symbol', 'profit'];

export const summaryHeader: CsvHeaderRow = [
  'profit',
  'profit trades',
  'loss trades',
];

const barAnalyzerEndOfDayTrade = async ({
  bars,
  buyingPower,
  buyingPowerMultiplier,
  symbol,
  tradeTimes,
}: {
  bars: Bar[];
  buyingPower: number;
  buyingPowerMultiplier: number;
  symbol: string;
  tradeTimes: TradeTimes[];
}): Promise<{
  buyingPower: number;
  rows: CsvRows;
  tradeTimes: TradeTimes[];
}> => {
  const rows: CsvRows = [];
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

    // 4:52
    const nearEndOfDayBars = bars.slice(0, index - 7);
    const nearEndOfDayBar = nearEndOfDayBars[nearEndOfDayBars.length - 1];

    const endOfDayResult = endOfDay({
      bars: nearEndOfDayBars,
      symbol,
    });

    if (!endOfDayResult) {
      continue;
    }

    const mostRecentBar = bars[bars.length - 1];
    const tradeStartTime = nearEndOfDayBar.t;
    const tradeEndTime = mostRecentBar.t;

    if (
      isWithinExistingTradeTime(tradeStartTime, tradeTimes) ||
      isWithinExistingTradeTime(tradeEndTime, tradeTimes)
    ) {
      continue;
    }

    const quantity = await getQuantity({
      buyingPower: updatedBuyingPower,
      buyingPowerNonMarginable: updatedBuyingPower / buyingPowerMultiplier,
      percentOfBuyingPower: PERCENT_OF_BUYING_POWER,
      price: endOfDayResult.price,
      stopPrice: endOfDayResult.stopPrice,
    });

    if (quantity <= 0) {
      continue;
    }

    const hypotheticalClosing =
      endOfDayResult.price > mostRecentBar.c
        ? endOfDayResult.stopPrice
        : mostRecentBar.c;

    const cost = quantity * endOfDayResult.price;
    const revenue = quantity * hypotheticalClosing;

    const profit = revenue - cost;

    updatedBuyingPower += profit;
    updatedTradeTimes.push({
      start: tradeStartTime,
      end: tradeEndTime,
    });
    rows.push([symbol, formatCurrencyNumber(profit)]);
  }

  return {
    buyingPower: updatedBuyingPower,
    rows,
    tradeTimes: updatedTradeTimes,
  };
};

export const barAnalyzerSummaryEndOfDayTrade = (rows: CsvRows): CsvRows => {
  let totalProfit = 0;
  let lossTrades = 0;
  let profitTrades = 0;
  for (const [, profit] of rows) {
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
