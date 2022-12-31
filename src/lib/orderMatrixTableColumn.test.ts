import orderMatrixTableColumn from './orderMatrixTableColumn';

describe('orderMatrixTableColumn', () => {
  it('should sort correctly', () => {
    const matrix = [
      ['ipsum', 'lorem', 3, 'foo'],
      ['foo', 'bar', 2, 'lorem'],
      ['okay', 'yessir', 2, 100],
      ['lorem', 'ipsum', 6, 'bar'],
      ['bar', 'foo', 0, 'lorem'],
    ];
    const result = orderMatrixTableColumn(matrix, 2);
    expect(result).toStrictEqual([
      ['bar', 'foo', 0, 'lorem'],
      ['foo', 'bar', 2, 'lorem'],
      ['okay', 'yessir', 2, 100],
      ['ipsum', 'lorem', 3, 'foo'],
      ['lorem', 'ipsum', 6, 'bar'],
    ]);
  });

  it('should sort correctly when ascending order is specified', () => {
    const matrix = [
      ['ipsum', 'lorem', 3, 'foo'],
      ['foo', 'bar', 2, 'lorem'],
      ['okay', 'yessir', 2, 100],
      ['lorem', 'ipsum', 6, 'bar'],
      ['bar', 'foo', 0, 'lorem'],
    ];
    const result = orderMatrixTableColumn(matrix, 2, 'asc');
    expect(result).toStrictEqual([
      ['bar', 'foo', 0, 'lorem'],
      ['foo', 'bar', 2, 'lorem'],
      ['okay', 'yessir', 2, 100],
      ['ipsum', 'lorem', 3, 'foo'],
      ['lorem', 'ipsum', 6, 'bar'],
    ]);
  });

  it('should sort correctly when descending order is specified', () => {
    const matrix = [
      ['ipsum', 'lorem', 3, 'foo'],
      ['foo', 'bar', 2, 'lorem'],
      ['okay', 'yessir', 2, 100],
      ['lorem', 'ipsum', 6, 'bar'],
      ['bar', 'foo', 0, 'lorem'],
    ];
    const result = orderMatrixTableColumn(matrix, 2, 'desc');
    expect(result).toStrictEqual([
      ['lorem', 'ipsum', 6, 'bar'],
      ['ipsum', 'lorem', 3, 'foo'],
      ['foo', 'bar', 2, 'lorem'],
      ['okay', 'yessir', 2, 100],
      ['bar', 'foo', 0, 'lorem'],
    ]);
  });
});
