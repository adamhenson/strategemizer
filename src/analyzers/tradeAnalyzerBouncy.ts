import moment from 'moment-timezone';
import { delay, formatCurrencyNumber, getPercentChange } from '../lib/utils';
import { Trade } from '../types';

moment.tz.setDefault('America/New_York');

const ORDER_TIME_SECONDS = 2;

interface TradeTimes {
  start: string;
  end: string;
}

interface TrendRecord {
  minutesBeforeExit?: number;
  percentLoss?: number;
  tradeTimes: TradeTimes[];
  updatedBuyingPower: number;
}

interface TrendRecordResult {
  buyingPowerStart: number;
  buyingPowerEnd: number;
  profitTradeCount: number;
  lossTradeCount: number;
  averageMinutesBeforeProfit: number;
  averageLossPercent: number;
  totalLossPercent: number;
  totalMinutesBeforeProfit: number;
}

const isWithinExistingTradeTime = (
  date: string,
  tradeTimes: TradeTimes[],
): boolean => {
  const matchingTimeframe = tradeTimes.find(
    ({ start, end }) =>
      moment(date).isAfter(moment(start)) && moment(date).isBefore(moment(end)),
  );
  return !!matchingTimeframe;
};

const lightTradeSimulation = ({
  buyingPower,
  detectedTrade,
  trades,
  tradeTimes,
}: {
  buyingPower: number;
  detectedTrade: Trade;
  trades: Trade[];
  tradeTimes: TradeTimes[];
}): TrendRecord | undefined => {
  let updatedBuyingPower = buyingPower;
  const price = detectedTrade.p;
  const entryOrderQuantity = Math.floor(updatedBuyingPower / price);
  const momentDetectedTrade = moment(detectedTrade.t);
  let hasEnteredTrade = false;
  const orderTime = moment(momentDetectedTrade).add(
    ORDER_TIME_SECONDS,
    'seconds',
  );
  const orderTimeIsoString = orderTime.toISOString();

  if (isWithinExistingTradeTime(orderTimeIsoString, tradeTimes)) {
    return;
  }

  let cost = entryOrderQuantity * price;
  let profitPrice = price + 0.01;

  // expirations. this is meant to be quickly entered and quickly exited
  const orderExpiration = moment(detectedTrade.t).add(10, 'seconds');
  const exitOrderExpiration = moment(detectedTrade.t).add(1, 'minutes');

  for (const [index, trade] of trades.entries()) {
    // theoretically we're in the range where our entry trade
    // could be initiated
    if (!hasEnteredTrade) {
      if (index > 0 && moment(trade.t).isAfter(orderExpiration)) {
        return;
      }
      if (orderTime.isBefore(moment(trade.t))) {
        if (trade.p <= detectedTrade.p) {
          hasEnteredTrade = true;
          // re-calculate cost if not equal
          if (trade.p < detectedTrade.p) {
            // maybe halfway between submitted price and acutal?
            const diff = detectedTrade.p - trade.p;
            const newPrice = price - diff / 2;
            cost = entryOrderQuantity * newPrice;
          }
          updatedBuyingPower -= cost;
        } else if (trade.p - 0.01 <= detectedTrade.p) {
          // let's assume within a cent, also an orde would have executed.
          hasEnteredTrade = true;
          updatedBuyingPower -= cost;
        }
      }
      continue;
    } else if (isWithinExistingTradeTime(trade.t, tradeTimes)) {
      return;
    } else if (trade.p >= profitPrice) {
      // theoretically we could sell here
      const minutesBeforeExit = moment(trade.t).diff(
        momentDetectedTrade,
        'minutes',
      );
      if (trade.p < detectedTrade.p) {
        // maybe halfway between submitted profit price and acutal?
        const diff = profitPrice - trade.p;
        profitPrice = profitPrice + diff / 2;
      }
      updatedBuyingPower += entryOrderQuantity * profitPrice;
      tradeTimes.push({
        start: orderTimeIsoString,
        end: trade.t,
      });
      return { minutesBeforeExit, tradeTimes, updatedBuyingPower };
    } else if (moment(trade.t).isAfter(exitOrderExpiration)) {
      updatedBuyingPower += entryOrderQuantity * trade.p;
      tradeTimes.push({
        start: orderTimeIsoString,
        end: trade.t,
      });
      return {
        percentLoss: getPercentChange(trade.p, profitPrice),
        tradeTimes,
        updatedBuyingPower,
      };
    } else if (index === trades.length - 1) {
      // last trade of the day
      updatedBuyingPower += entryOrderQuantity * trade.p;
      tradeTimes.push({
        start: orderTimeIsoString,
        end: trade.t,
      });
      return {
        percentLoss: getPercentChange(trade.p, profitPrice),
        tradeTimes,
        updatedBuyingPower,
      };
    }
  }
  return;
};

interface TradeAnalyzerBouncyResult {
  profit: number;
  profitTrades: number;
  lossTrades: number;
  averageMinutesBeforeProfitTrade: number;
  avearageLossPercent: number;
}

// the pattern: price goes down from one trade to another, and the next trade
// goes up, then down again. althought this is a rough pattern without taking
// into account many factors, it does signify some jumpiness. and the point
// of this experiment is fo find out if a trade was made here, what is the
// liklihood of being able to sell for 1 cent more soonafter. it should be
// very likely, however in the event that it doesn't occur, how bad could the
// loss get. this does not consider overlapping trades.
const tradeAnalyzerBouncy = async ({
  buyingPower = 30000,
  trades,
}: {
  buyingPower?: number;
  trades: Trade[];
}): Promise<TradeAnalyzerBouncyResult> => {
  let updatedBuyingPower = buyingPower;
  let tradeTimes: TradeTimes[] = [];
  const results: TrendRecord[] = [];
  const analyzeTrade = async ({ index }: { index: number }): Promise<void> => {
    // just used to avoid "Maximum call stack size exceeded" error
    await delay(0);

    const trade = trades[index];

    if (!trade) {
      return;
    }

    // check 1 of 3 ⬇️
    if (trades[index - 1].p < trade.p) {
      return analyzeTrade({ index: index + 1 });
    }

    // check 2 of 3 ⬆️
    const nextTrade = trades[index + 1];
    if (!nextTrade) {
      return;
    }
    if (trade.p > nextTrade.p) {
      return analyzeTrade({ index: index + 1 });
    }

    // check 3 of 3 ⬇️
    const nextTradeThirdIndex = index + 2;
    const nextTradeThird = trades[nextTradeThirdIndex];
    if (!nextTradeThird) {
      return;
    }
    if (nextTrade.p < nextTradeThird.p) {
      return analyzeTrade({ index: index + 1 });
    }

    const result = lightTradeSimulation({
      buyingPower: updatedBuyingPower,
      detectedTrade: nextTradeThird,
      trades: trades.slice(nextTradeThirdIndex + 1),
      tradeTimes,
    });

    if (result) {
      results.push(result);
      updatedBuyingPower = result.updatedBuyingPower;
      tradeTimes = result.tradeTimes;
    }

    return analyzeTrade({ index: index + 1 });
  };

  console.log('processing...');
  console.log('');

  await analyzeTrade({ index: 1 });

  const overallResult: TrendRecordResult = {
    buyingPowerStart: buyingPower,
    buyingPowerEnd: updatedBuyingPower,
    profitTradeCount: 0,
    lossTradeCount: 0,
    averageMinutesBeforeProfit: 0,
    averageLossPercent: 0,
    totalLossPercent: 0,
    totalMinutesBeforeProfit: 0,
  };

  for (const result of results) {
    if (result.percentLoss) {
      overallResult.lossTradeCount++;
      overallResult.totalLossPercent += result.percentLoss;
    } else if (result.minutesBeforeExit) {
      overallResult.profitTradeCount++;
      overallResult.totalMinutesBeforeProfit += result.minutesBeforeExit;
    }
  }

  overallResult.averageLossPercent = formatCurrencyNumber(
    overallResult.totalLossPercent / overallResult.lossTradeCount,
  );
  overallResult.averageMinutesBeforeProfit = formatCurrencyNumber(
    overallResult.totalMinutesBeforeProfit / overallResult.profitTradeCount,
  );

  return {
    profit: formatCurrencyNumber(
      overallResult.buyingPowerEnd - overallResult.buyingPowerStart,
    ),
    profitTrades: overallResult.profitTradeCount,
    lossTrades: overallResult.lossTradeCount,
    averageMinutesBeforeProfitTrade: overallResult.averageMinutesBeforeProfit,
    avearageLossPercent: overallResult.averageLossPercent,
  };
};

export default tradeAnalyzerBouncy;
