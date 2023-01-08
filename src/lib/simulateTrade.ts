import moment from 'moment-timezone';
import { Trade } from '../types';
import AlpacaClient from './AlpacaClient';
import { delay, formatCurrencyNumber, getQty } from './utils';

moment.tz.setDefault('America/New_York');

const ORDER_EXECUTION_SECONDS = 2;
const PRICE_REPS_TO_PROVE = 5;

// account for delay to fulfill the buy order submission and also that our
// strategy result `t` time represents the bar open time
const ORDER_TIME_DIFF = 60 + ORDER_EXECUTION_SECONDS;

const { LOG_LEVEL = 'error' } = process.env;

const shouldLog =
  LOG_LEVEL.includes('verbose') && !LOG_LEVEL.includes('no-trade-simulate');

// we don't place orders after 3:58:59
export const isTimeWithinTradeDay = (date: string) => {
  const momentTrade = moment(date);
  const hour = momentTrade.hour();
  const minute = momentTrade.minute();

  // 9am - 3:59pm (no orders after 3:58:59)
  if (hour > 15 || (hour === 15 && minute >= 59)) {
    return false;
  }
  if (hour < 9 || (hour === 9 && minute < 30)) {
    return false;
  }

  return true;
};

const RETRY_MAX = 5;

// we cancel entry orders after the seconds below
const MAX_SECONDS_OPEN_ORDER = 60;

const getPrefixLog = ({
  exitPrice,
  isShort,
  price,
  symbol,
}: {
  exitPrice: number;
  isShort?: boolean;
  price: number;
  symbol: string;
}) =>
  !isShort && exitPrice < price
    ? `[x] ${symbol}: loss of $${formatCurrencyNumber(price - exitPrice)}`
    : !isShort && exitPrice > price
    ? `[✔️] ${symbol}: profit of $${formatCurrencyNumber(price - exitPrice)}`
    : isShort && exitPrice < price
    ? `[✔️] ${symbol}: profit of $${formatCurrencyNumber(price - exitPrice)}`
    : isShort && exitPrice > price
    ? `[x] ${symbol}: loss of $${formatCurrencyNumber(price - exitPrice)}`
    : `[*] ${symbol}: break even`;

interface SimulateTradeReturn {
  entryDate?: string;
  loss: number;
  lossPercent: number;

  // entry date and exit date
  points: [string | undefined, string | undefined];
  profit: number;
  profitPercent: number;
  qty: number;
  exitDate: string;
  exitTotal: number;
  exitPrice: number;
  spent: number;
  targetedLoss: number;
  targetedLossPercent: number;
  targetedProfit: number;
  targetedProfitPercent: number;
}

const simulateTrade = async ({
  accountBudget,
  accountBudgetMultiplier = 2,
  accountBudgetPercentPerTrade,
  alpacaClient,
  entryDate: entryDateParam,
  isFractional,
  isShort,
  hwm: hwmParam,
  maxLossPercent,
  mostRecentTrade: mostRecentTradeParam,
  priceProofEntry: priceProofEntryParam,
  priceProofExit: priceProofExitParam,
  priceProofStop: priceProofStopParam,
  next_page_token,
  retryCount = 0,
  sellOnDownwardMovement = true,
  strategyResult,

  // this is only used with recursion and should not be set
  // initially
  stopPrice: stopPriceParam,
  symbol,
}: {
  accountBudget: number;
  accountBudgetMultiplier?: number;
  accountBudgetPercentPerTrade: number;
  alpacaClient: AlpacaClient;
  entryDate?: string;
  isFractional?: boolean;
  isShort?: boolean;
  hwm?: number;
  maxLossPercent?: number;
  mostRecentTrade?: Trade;
  priceProofEntry?: number[];
  priceProofExit?: number[];
  priceProofStop?: number[];
  next_page_token?: string;
  retryCount?: number;
  sellOnDownwardMovement?: boolean;
  strategyResult: any;
  stopPrice?: number;
  symbol: string;
}): Promise<SimulateTradeReturn | undefined> => {
  const qty = await getQty({
    buyingPower: accountBudget,
    buyingPowerNonMarginable: accountBudget / accountBudgetMultiplier,
    isFractional,
    isShort,
    maxLossPercent,
    percentOfBuyingPower: accountBudgetPercentPerTrade,
    price: strategyResult.price,
    stopPrice: strategyResult.stopPrice,
  });

  if (!qty) {
    return;
  }

  const orderReadyTime = strategyResult.orderReadyTime || strategyResult.t;

  const start = moment(orderReadyTime)
    .add(ORDER_TIME_DIFF, 'seconds')
    .toISOString();

  const entryOrderDateDeadline = moment(start).add(
    MAX_SECONDS_OPEN_ORDER,
    'seconds',
  );

  // we liquidate somewhere around 5 seconds after 3:59:30pm, so we make sure
  // our last bar fits within that
  const end = moment(orderReadyTime)
    .set({
      hour: 15,
      minute: 59,
      milliseconds: 0,
      seconds: 35,
    })
    .toISOString();

  if (moment(start).isAfter(moment(end))) {
    console.log('start is after end', {
      start,
      end,
    });
    return;
  }

  const tradeResult = await alpacaClient.getTrades(symbol, {
    end,
    start,
    page_token: next_page_token,
  });

  if (tradeResult.error) {
    console.log(`${symbol}: error fetching trades`, tradeResult.error);
    if (retryCount > RETRY_MAX) {
      console.log(`${symbol}: retries maxed... giving up on simulate trade`);
      return;
    }
    await delay(3000);
    return simulateTrade({
      accountBudgetMultiplier,
      accountBudget,
      accountBudgetPercentPerTrade,
      alpacaClient,
      entryDate: entryDateParam,
      hwm: hwmParam,
      isShort,
      maxLossPercent,
      mostRecentTrade: mostRecentTradeParam,
      next_page_token,
      priceProofEntry: priceProofEntryParam,
      priceProofExit: priceProofExitParam,
      priceProofStop: priceProofStopParam,
      retryCount: retryCount + 1,
      sellOnDownwardMovement,
      strategyResult,
      stopPrice: stopPriceParam,
      symbol,
    });
  }

  if (!tradeResult.trades || !tradeResult.trades.length) {
    return;
  }

  const { trailPercent } = strategyResult;

  // loop through trades to determine when our theoretical entry and
  // exit would occur and for how much approximately
  let entryDate = entryDateParam;
  let exitDate;
  let exitPrice;
  let hwm = hwmParam;
  let isOrderStale = false;
  let mostRecentTrade = mostRecentTradeParam;
  let priceProofEntry = priceProofEntryParam || [];
  let priceProofExit = priceProofExitParam || [];
  let priceProofStop = priceProofStopParam || [];

  let stopPrice =
    stopPriceParam || !trailPercent ? strategyResult.stopPrice : undefined;

  for (const trade of tradeResult.trades) {
    // we sell within the standard market hours
    if (!isTimeWithinTradeDay(trade.t)) {
      continue;
    }

    mostRecentTrade = trade;

    if (
      trailPercent &&
      ((!isShort && (!hwm || trade.p > hwm)) ||
        (isShort && (!hwm || trade.p < hwm)))
    ) {
      hwm = trade.p as number;

      // calculate this the way alpaca would:
      // https://alpaca.markets/docs/trading/orders/#trailing-stop-orders
      // a percent value away from the highest water mark. If you set this
      // to 1.0 for a sell trailing stop, the stop price is always hwm * 0.99
      stopPrice = hwm * (trailPercent / 100);
    }

    if (!entryDate) {
      // if we've exceeded our order deadline
      if (moment(trade.t).isAfter(entryOrderDateDeadline)) {
        if (shouldLog) {
          console.log(`[-] ${symbol}: order deadline exceeded`, {
            tradeTime: trade.t,
            entryOrderDateDeadline: entryOrderDateDeadline.toISOString(),
          });
        }
        isOrderStale = true;
        break;
      }

      // if entry price is comparible to a trade price, then in theory - it
      // will be accepted
      if (
        (!isShort && trade.p <= strategyResult.price) ||
        (isShort && trade.p >= strategyResult.price)
      ) {
        priceProofEntry.push(trade.p);
        if (priceProofEntry.length >= PRICE_REPS_TO_PROVE) {
          entryDate = moment(trade.t)
            .add(ORDER_EXECUTION_SECONDS, 'seconds')
            .toISOString();
        }
      }
      continue;
    }

    // if current trade is occurring after our entry trade,
    if (
      moment(trade.t).isAfter(
        moment(entryDate).add(ORDER_EXECUTION_SECONDS, 'seconds'),
      )
    ) {
      // if we're using a trailing percent, then we only set a trailing
      // stop and we don't set profit
      if (!trailPercent) {
        // if we've met or exceeded the targeted profit price
        if (
          (!isShort && strategyResult.profitPrice <= trade.p) ||
          (isShort && strategyResult.profitPrice >= trade.p)
        ) {
          priceProofExit.push(trade.p);
          if (priceProofExit.length >= PRICE_REPS_TO_PROVE) {
            // determine the hypothetical exit price based on bid
            // and proof combined and averaged
            const proofAndBid = [...priceProofExit, strategyResult.profitPrice];
            const proofAndBidSum = proofAndBid.reduce(
              (accumulator, current) => accumulator + current,
              0,
            );
            exitPrice = formatCurrencyNumber(
              proofAndBidSum / proofAndBid.length,
            );
            exitDate = trade.t;
            if (shouldLog) {
              console.log(
                `[✔️] ${symbol}: profit of $${formatCurrencyNumber(
                  exitPrice - strategyResult.price,
                )}` + ` at ${moment(exitDate).format('YYYY-MM-DD h:mm:ss a')}`,
              );
            }
            break;
          }
        }
      }

      // if we've met or exceeded the targeted stop price
      if (
        (!isShort && stopPrice >= trade.p) ||
        (isShort && stopPrice <= trade.p)
      ) {
        priceProofStop.push(trade.p);
        if (priceProofStop.length >= PRICE_REPS_TO_PROVE) {
          // determine the hypothetical stop price based on stop
          // and proof combined and averaged
          const proofAndBid = [...priceProofStop, stopPrice];
          const proofAndBidSum = proofAndBid.reduce(
            (accumulator, current) => accumulator + current,
            0,
          );
          exitPrice = formatCurrencyNumber(proofAndBidSum / proofAndBid.length);
          exitDate = trade.t;
          if (shouldLog) {
            // if using a trailing percent, a stop could actually
            // be a profit
            const prefixLog = getPrefixLog({
              exitPrice,
              isShort,
              price: strategyResult.price,
              symbol,
            });
            console.log(
              `${prefixLog} at ${moment(exitDate).format(
                'YYYY-MM-DD h:mm:ss a',
              )}`,
            );
          }
          break;
        }
      }
    }
  }

  if (
    isOrderStale ||
    !mostRecentTrade ||
    (!entryDate && !tradeResult.next_page_token)
  ) {
    return;
  }

  if ((!entryDate || !exitPrice) && tradeResult.next_page_token) {
    if (shouldLog) {
      console.log(
        `${symbol}: trying again with next page token ${tradeResult.next_page_token}`,
      );
    }
    // try again with the next page token
    return simulateTrade({
      accountBudgetMultiplier,
      accountBudget,
      accountBudgetPercentPerTrade,
      alpacaClient,
      entryDate,
      hwm,
      isShort,
      maxLossPercent,
      mostRecentTrade,
      next_page_token: tradeResult.next_page_token,
      priceProofEntry,
      priceProofExit,
      priceProofStop,
      retryCount,
      sellOnDownwardMovement,
      stopPrice,
      strategyResult,
      symbol,
    });
  }

  // if we made it this far, it's the end of the day and we'll
  // end up selling for market value
  if (!exitPrice) {
    exitPrice = mostRecentTrade.p;
    exitDate = end;
    if (shouldLog) {
      const prefixLog = getPrefixLog({
        exitPrice,
        isShort,
        price: strategyResult.price,
        symbol,
      });
      console.log(
        `${prefixLog} at ${moment(end).format('YYYY-MM-DD h:mm:ss a')}`,
      );
    }
  }

  exitPrice = formatCurrencyNumber(exitPrice);

  const spent = formatCurrencyNumber(qty * strategyResult.price);
  const exitTotal = formatCurrencyNumber(qty * exitPrice);
  const targetedSoldForProfit = formatCurrencyNumber(
    qty * strategyResult.profitPrice,
  );
  const targetedSoldForLoss = formatCurrencyNumber(
    qty * strategyResult.stopPrice,
  );

  const targetedProfit = !isShort
    ? formatCurrencyNumber(targetedSoldForProfit - spent)
    : formatCurrencyNumber(spent - targetedSoldForProfit);
  const targetedProfitPercent = formatCurrencyNumber(
    (targetedProfit / spent) * 100,
  );
  const targetedLoss = !isShort
    ? formatCurrencyNumber(spent - targetedSoldForLoss)
    : formatCurrencyNumber(targetedSoldForLoss - spent);
  const targetedLossPercent = formatCurrencyNumber(
    (targetedLoss / spent) * 100,
  );

  let profit;
  let profitPercent;
  let loss;
  let lossPercent;

  if (!isShort) {
    profit = spent >= exitTotal ? 0 : formatCurrencyNumber(exitTotal - spent);
    loss = spent <= exitTotal ? 0 : formatCurrencyNumber(spent - exitTotal);

    // https://www.investopedia.com/ask/answers/05/stockgainsandlosses.asp#:~:text=To%20calculate%20your%20profit%20or,and%20multiplies%20that%20by%20100.
    profitPercent = !profit ? 0 : formatCurrencyNumber((profit / spent) * 100);
    lossPercent = !loss ? 0 : formatCurrencyNumber((loss / spent) * 100);
  } else {
    profit = spent <= exitTotal ? 0 : formatCurrencyNumber(spent - exitTotal);
    loss = spent >= exitTotal ? 0 : formatCurrencyNumber(exitTotal - spent);
    profitPercent = !profit
      ? 0
      : formatCurrencyNumber((profit / exitTotal) * 100);
    lossPercent = !loss ? 0 : formatCurrencyNumber((loss / exitTotal) * 100);
  }

  return {
    entryDate,
    loss,
    lossPercent,
    points: [entryDate, exitDate],
    profit,
    profitPercent,
    qty,
    exitDate,
    exitTotal,
    exitPrice,
    spent,
    targetedLoss,
    targetedLossPercent,
    targetedProfit,
    targetedProfitPercent,
  };
};

export default simulateTrade;
