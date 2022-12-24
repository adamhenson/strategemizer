import getCombinations from './combinations';

const arrayHasCombo = (needle: any[], haystack: any[]) => {
  return !!haystack.find((current) => {
    if (needle.length !== current.length) {
      return false;
    }
    for (const needleItem of needle) {
      if (!current.includes(needleItem)) {
        return false;
      }
    }
    return true;
  });
};

describe('combinations', () => {
  it('should return all combinations', () => {
    const input = [
      ['a', 'b'],
      [1, 2],
      ['🌏', '💨', '🔥'],
    ];
    const result = getCombinations<string | number>(input);
    expect(result.length).toEqual(12);
    expect(arrayHasCombo(['a', 1, '🌏'], result)).toBe(true);
    expect(arrayHasCombo(['a', 2, '🌏'], result)).toBe(true);
    expect(arrayHasCombo(['a', 1, '💨'], result)).toBe(true);
    expect(arrayHasCombo(['a', 2, '💨'], result)).toBe(true);
    expect(arrayHasCombo(['a', 1, '🔥'], result)).toBe(true);
    expect(arrayHasCombo(['a', 2, '🔥'], result)).toBe(true);
    expect(arrayHasCombo(['b', 1, '🌏'], result)).toBe(true);
    expect(arrayHasCombo(['b', 2, '🌏'], result)).toBe(true);
    expect(arrayHasCombo(['b', 1, '💨'], result)).toBe(true);
    expect(arrayHasCombo(['b', 2, '💨'], result)).toBe(true);
    expect(arrayHasCombo(['b', 1, '🔥'], result)).toBe(true);
    expect(arrayHasCombo(['b', 2, '🔥'], result)).toBe(true);
  });
});
