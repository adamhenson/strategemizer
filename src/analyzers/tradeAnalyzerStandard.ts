import { delay, formatCurrencyNumber, getPercentChange } from '../lib/utils';
import { Trade } from '../types';

interface TrendRecord {
  nextTradeChangedPercentDeclines: number[];
  nextTradeContinuedPercentIncreases: number[];
}

interface TrendRecordTotal {
  nextTradeChangedPercentDeclineAverage: number;
  nextTradeChangedPercentDeclineCount: number;
  nextTradeContinuedPercentIncreaseAverage: number;
  nextTradeContinuedPercentIncreaseCount: number;
}

type TrendRecordTotalCollection = Record<string, TrendRecordTotal>;

const DEFAULT_TREND_COUNT = 1;

const tradeAnalyzerStandard = async ({ trades }: { trades: Trade[] }) => {
  const defaultRecord: TrendRecord = {
    nextTradeChangedPercentDeclines: [],
    nextTradeContinuedPercentIncreases: [],
  };

  const upwardTrends: Record<string, TrendRecord> = {};

  const analyzeTrade = async ({
    index,
    hasPreviousTrend = false,
    trendCount = DEFAULT_TREND_COUNT,
  }: {
    index: number;
    hasPreviousTrend?: boolean;
    trendCount?: number;
  }): Promise<void> => {
    // just used to avoid "Maximum call stack size exceeded" error
    await delay(0);
    const previousTrade = trades[index - 1];
    const secondPreviousTrade = trades[index - 2];
    const hasPreviousDownwardTrend = secondPreviousTrade.p > previousTrade.p;
    const hasNext = trades.length - 1 >= index;
    if (!hasNext) {
      return;
    }

    if (!hasPreviousTrend && !hasPreviousDownwardTrend) {
      return analyzeTrade({
        index: index + 1,
        trendCount: DEFAULT_TREND_COUNT,
      });
    }

    const currentTrade = trades[index];
    const hasUptrend = previousTrade.p < currentTrade.p;

    if (!hasUptrend) {
      return analyzeTrade({
        index: index + 1,
        trendCount: DEFAULT_TREND_COUNT,
      });
    }

    const nextTrade = trades[index + 1];
    const hasUptrendNext = currentTrade.p < nextTrade.p;
    const percentChange = getPercentChange(currentTrade.p, nextTrade.p);

    if (!upwardTrends[`${trendCount}`]) {
      upwardTrends[`${trendCount}`] = structuredClone(defaultRecord);
    }

    if (hasUptrendNext) {
      upwardTrends[`${trendCount}`].nextTradeContinuedPercentIncreases.push(
        percentChange,
      );
      return analyzeTrade({
        hasPreviousTrend: true,
        index: index + 1,
        trendCount: trendCount + 1,
      });
    }

    upwardTrends[`${trendCount}`].nextTradeChangedPercentDeclines.push(
      percentChange,
    );
    return analyzeTrade({
      index: index + 1,
    });
  };

  console.log('processing...');

  await analyzeTrade({
    index: 3,
  });

  const result = Object.keys(upwardTrends).reduce(
    (accumulator: TrendRecordTotalCollection, current) => {
      let declineCount = 0;
      let declineTotal = 0;
      let increaseCount = 0;
      let increaseTotal = 0;
      const currentTrend = upwardTrends[current];
      currentTrend.nextTradeChangedPercentDeclines.forEach((current) => {
        declineTotal += current;
      });
      declineCount = currentTrend.nextTradeChangedPercentDeclines.length;
      currentTrend.nextTradeContinuedPercentIncreases.forEach((current) => {
        increaseTotal += current;
      });
      increaseCount = currentTrend.nextTradeContinuedPercentIncreases.length;
      return {
        ...accumulator,
        [current]: {
          nextTradeChangedPercentDeclineAverage: !declineCount
            ? 0
            : formatCurrencyNumber(declineTotal / declineCount),
          nextTradeChangedPercentDeclineCount: declineCount,
          nextTradeContinuedPercentIncreaseAverage: !increaseCount
            ? 0
            : formatCurrencyNumber(increaseTotal / increaseCount),
          nextTradeContinuedPercentIncreaseCount: increaseCount,
        },
      };
    },
    {},
  );

  console.log('result', result);
};

export default tradeAnalyzerStandard;
