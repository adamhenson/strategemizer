const orderMatrixTableColumn = <Type>(
  arrayOfArrays: Type[][],
  indexOfColumnToSortBy: number,
  order: 'asc' | 'desc' = 'asc',
): Type[][] => {
  arrayOfArrays.sort((a, b) => {
    const aValue = a[indexOfColumnToSortBy];
    const bValue = b[indexOfColumnToSortBy];
    if (aValue < bValue) {
      if (order === 'asc') {
        return -1;
      }
      return 1;
    }
    if (aValue > bValue) {
      if (order === 'asc') {
        return 1;
      }
      return -1;
    }
    return 0;
  });
  return arrayOfArrays;
};

export default orderMatrixTableColumn;
