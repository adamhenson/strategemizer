import getConfigVariations from './getConfigVariations';

describe('getConfigVariations', () => {
  it('should return no variations', () => {
    const config = {
      ipsum: 1,
      lorem: 2,
    };
    const result = getConfigVariations(config);
    expect(result).toStrictEqual([{ ipsum: 1, lorem: 2 }]);
  });

  it('should return all simple variations', () => {
    const config = {
      ipsum: 1,
      lorem: 2,
      range1: {
        type: 'range',
        increment: 1,
        range: [1, 3],
      },
    };
    const result = getConfigVariations(config);
    expect(result).toStrictEqual([
      { ipsum: 1, lorem: 2, range1: 1, variation: 1 },
      { ipsum: 1, lorem: 2, range1: 2, variation: 2 },
      { ipsum: 1, lorem: 2, range1: 3, variation: 3 },
    ]);
  });

  it('should return all complex variations', () => {
    const config = {
      ipsum: 1,
      lorem: 2,
      range1: {
        type: 'range',
        increment: 1,
        range: [1, 3],
      },
      range2: {
        type: 'range',
        increment: 0,
        range: [true, false],
      },
      range3: {
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
        range1: 1,
        range2: true,
        range3: 4,
        variation: 1,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 1,
        range2: true,
        range3: 5,
        variation: 2,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 1,
        range2: true,
        range3: 6,
        variation: 3,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 1,
        range2: false,
        range3: 4,
        variation: 4,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 1,
        range2: false,
        range3: 5,
        variation: 5,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 1,
        range2: false,
        range3: 6,
        variation: 6,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 2,
        range2: true,
        range3: 4,
        variation: 7,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 2,
        range2: true,
        range3: 5,
        variation: 8,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 2,
        range2: true,
        range3: 6,
        variation: 9,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 2,
        range2: false,
        range3: 4,
        variation: 10,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 2,
        range2: false,
        range3: 5,
        variation: 11,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 2,
        range2: false,
        range3: 6,
        variation: 12,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 3,
        range2: true,
        range3: 4,
        variation: 13,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 3,
        range2: true,
        range3: 5,
        variation: 14,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 3,
        range2: true,
        range3: 6,
        variation: 15,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 3,
        range2: false,
        range3: 4,
        variation: 16,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 3,
        range2: false,
        range3: 5,
        variation: 17,
      },
      {
        ipsum: 1,
        lorem: 2,
        range1: 3,
        range2: false,
        range3: 6,
        variation: 18,
      },
    ]);
  });
});
