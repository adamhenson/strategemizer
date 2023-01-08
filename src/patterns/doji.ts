import { formattedLog } from '../lib/utils';

const name = 'doji';

const { LOG_LEVEL = 'error' } = process.env;

const shouldLog = LOG_LEVEL.includes(name);

const BODY_PERCENT_OF_RANGE = 33.333333333333;

interface IndicatorData {
  close: number;
  high: number;
  low: number;
  open: number;
}

interface IndicatorDataLists {
  close: number[];
  high: number[];
  low: number[];
  open: number[];
}

const isBodySizeQualified = (
  { close, high, low, open }: IndicatorData,
  bodyPercentOfRange: number,
) => {
  const barDistance = high - low;

  let bodyDistance;

  if (open > close) {
    bodyDistance = open - close;
  } else {
    bodyDistance = close - open;
  }

  const bodyPercentOfBar = (bodyDistance / barDistance) * 100;
  return bodyPercentOfBar <= bodyPercentOfRange;
};

export const dojiCreator =
  ({ bodyPercentOfRange = BODY_PERCENT_OF_RANGE }) =>
  (input: IndicatorDataLists, symbol: string) => {
    if (input.close[0] === input.open[0]) {
      return false;
    }

    if (
      !isBodySizeQualified(
        {
          close: input.close[0],
          high: input.high[0],
          low: input.low[0],
          open: input.open[0],
        },
        bodyPercentOfRange,
      )
    ) {
      if (shouldLog) {
        formattedLog({
          isBad: true,
          message: `body size isn't qualified`,
          name,
          symbol,
        });
      }
      return false;
    }

    return true;
  };

export default dojiCreator({});
