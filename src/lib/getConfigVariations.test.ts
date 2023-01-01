import getConfigVariations from './getConfigVariations';

describe('getConfigVariations', () => {
  it('should return 1 variation', () => {
    const config = {
      ipsum: 1,
      lorem: 2,
    };
    const result = getConfigVariations(config);
    expect(result).toStrictEqual([{ ipsum: 1, lorem: 2, variation: 1 }]);
  });

  it('should return all simple variations', () => {
    const config = {
      ipsum: 1,
      lorem: 2,
      variation1: {
        type: 'range',
        increment: 1,
        range: [1, 3],
      },
    };
    const result = getConfigVariations(config);
    expect(result).toStrictEqual([
      { ipsum: 1, lorem: 2, variation1: 1, variation: 1 },
      { ipsum: 1, lorem: 2, variation1: 2, variation: 2 },
      { ipsum: 1, lorem: 2, variation1: 3, variation: 3 },
    ]);
  });

  it('should return all complex variations', () => {
    const config = {
      ipsum: 1,
      lorem: 2,
      variation1: {
        type: 'range',
        increment: 1,
        range: [1, 3],
      },
      variation2: {
        type: 'or',
        or: [true, false],
      },
      variation3: {
        type: 'range',
        increment: 1,
        range: [4, 6],
      },
    };
    const result = getConfigVariations(config);
    expect(result).toStrictEqual([
      {
        ipsum: 1,
        lorem: 2,
        variation1: 1,
        variation2: true,
        variation3: 4,
        variation: 1,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 1,
        variation2: true,
        variation3: 5,
        variation: 2,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 1,
        variation2: true,
        variation3: 6,
        variation: 3,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 1,
        variation2: false,
        variation3: 4,
        variation: 4,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 1,
        variation2: false,
        variation3: 5,
        variation: 5,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 1,
        variation2: false,
        variation3: 6,
        variation: 6,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 2,
        variation2: true,
        variation3: 4,
        variation: 7,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 2,
        variation2: true,
        variation3: 5,
        variation: 8,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 2,
        variation2: true,
        variation3: 6,
        variation: 9,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 2,
        variation2: false,
        variation3: 4,
        variation: 10,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 2,
        variation2: false,
        variation3: 5,
        variation: 11,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 2,
        variation2: false,
        variation3: 6,
        variation: 12,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 3,
        variation2: true,
        variation3: 4,
        variation: 13,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 3,
        variation2: true,
        variation3: 5,
        variation: 14,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 3,
        variation2: true,
        variation3: 6,
        variation: 15,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 3,
        variation2: false,
        variation3: 4,
        variation: 16,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 3,
        variation2: false,
        variation3: 5,
        variation: 17,
      },
      {
        ipsum: 1,
        lorem: 2,
        variation1: 3,
        variation2: false,
        variation3: 6,
        variation: 18,
      },
    ]);
  });
});
