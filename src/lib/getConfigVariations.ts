import { StrategyConfig } from '../types';
import getCombinations from './combinations';

type NumberOrBoolean = number | boolean;

// when a config has a range signified by a tuple, generate all
// possible variations
const getConfigVariations = (config: StrategyConfig): StrategyConfig[] => {
  const [variationKeys, standardKeys] = Object.keys(config).reduce(
    (accumulator: [string[], string[]], current) => {
      const value = config[current];
      const isRange =
        typeof value === 'object' &&
        ((value.type === 'range' &&
          value.range?.length === 2 &&
          typeof value.increment === 'number') ||
          (value.type === 'or' && value.or?.length >= 2));
      if (!isRange) {
        return [accumulator[0], [...accumulator[1], current]];
      }
      return [[...accumulator[0], current], accumulator[1]];
    },
    [[], []],
  );

  if (variationKeys.length === 0) {
    return [
      {
        ...config,
        variation: 1,
      },
    ];
  }

  const variations: Record<string, NumberOrBoolean[]> = {};

  for (const variationKey of variationKeys) {
    const { increment, or, range, type } = config[variationKey];

    if (type === 'or' && or) {
      variations[variationKey] = or;
      continue;
    } else if (type === 'range' && range) {
      const [range1, range2] = range;
      variations[variationKey] = [range1];
      let lastOfRange = range1;
      while (lastOfRange < range2) {
        const last =
          variations[variationKey][variations[variationKey].length - 1];
        const next = last + increment;
        if (next > range2) {
          variations[variationKey].push(range2);
          lastOfRange = range2;
        } else {
          variations[variationKey].push(next);
          lastOfRange = next;
        }
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

  const combinations = getCombinations(Object.values(variations));
  const finalRangeKeys = Object.keys(variations);

  return combinations.reduce(
    (accumulator: StrategyConfig[], current, index) => {
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
    },
    [],
  );
};

export default getConfigVariations;
