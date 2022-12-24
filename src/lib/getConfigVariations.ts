import { Config } from '../types';
import getCombinations from './combinations';

type NumberOrBoolean = number | boolean;

// when a config has a range signified by a tuple, generate all
// possible variations
const getConfigVariations = (config: Config): Config[] => {
  const [rangeKeys, standardKeys] = Object.keys(config).reduce(
    (accumulator: [string[], string[]], current) => {
      const value = config[current];
      const isRange =
        typeof value === 'object' &&
        value.type === 'range' &&
        typeof value.increment === 'number' &&
        value.range?.length === 2;
      if (!isRange) {
        return [accumulator[0], [...accumulator[1], current]];
      }
      return [[...accumulator[0], current], accumulator[1]];
    },
    [[], []],
  );

  if (rangeKeys.length === 0) {
    return [config];
  }

  const ranges: Record<string, NumberOrBoolean[]> = {};

  for (const rangeKey of rangeKeys) {
    const { increment, range } = config[rangeKey];
    const [range1, range2] = range;

    // we can have a boolean range... meaning we want
    // to try both boolean values
    if (typeof range1 === 'boolean') {
      ranges[rangeKey] = [range1, range2];
      continue;
    }

    ranges[rangeKey] = [range1];
    let lastOfRange = range1;
    while (lastOfRange < range2) {
      const last = ranges[rangeKey][ranges[rangeKey].length - 1];
      const next = last + increment;
      if (next > range2) {
        ranges[rangeKey].push(range2);
        lastOfRange = range2;
      } else {
        ranges[rangeKey].push(next);
        lastOfRange = next;
      }
    }
  }

  const standardConfig = standardKeys.reduce(
    (accumulator, current) => ({
      ...accumulator,
      [current]: config[current],
    }),
    {},
  );

  const combinations = getCombinations(Object.values(ranges));
  const finalRangeKeys = Object.keys(ranges);

  return combinations.reduce((accumulator: Config[], current, index) => {
    return [
      ...accumulator,
      {
        ...standardConfig,
        ...current.reduce(
          (accumulator, current, index) => ({
            ...accumulator,
            [finalRangeKeys[index]]: current,
          }),
          {},
        ),
        variation: index + 1,
      },
    ];
  }, []);
};

export default getConfigVariations;
