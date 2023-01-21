import fs from 'fs';
import { CsvRows, CsvHeaderRow } from '../types';

const createCsv = ({
  content,
  header,
  outputPath,
}: {
  content: CsvRows;
  header: CsvHeaderRow;
  outputPath: string;
}) => {
  const csvHeader = `${header.join(', ')}\n`;
  const csvContent = content.map((row) => `${row.join(', ')}`).join('\n');
  fs.writeFileSync(outputPath, `${csvHeader}${csvContent}`);
};

export default createCsv;
