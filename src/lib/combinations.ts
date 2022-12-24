// inspired by https://stackoverflow.com/a/15310051
// returns all combinations of an array of arrays
const getCombinations = <Type>(arrayOfArrays: Type[][]): Type[][] => {
  const combinations: Type[][] = [];
  let max = arrayOfArrays.length - 1;
  function helper(array: Type[], i: number) {
    for (let j = 0, l = arrayOfArrays[i].length; j < l; j++) {
      const a = [...array];
      a.push(arrayOfArrays[i][j]);
      if (i === max) {
        combinations.push(a);
      } else {
        helper(a, i + 1);
      }
    }
  }
  helper([], 0);
  return combinations;
};

export default getCombinations;
