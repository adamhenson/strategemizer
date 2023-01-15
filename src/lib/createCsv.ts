import fs from 'fs';

export type Content = string | number;

const createCsv = ({
  content,
  header,
  outputPath,
}: {
  content: Content[][];
  header: Content[];
  outputPath: string;
}) => {
  const csvHeader = `${header.join(',')}\n`;
  const csvContent = content.map((row) => `${row.join(',')}`).join('\n');
  fs.writeFileSync(outputPath, `${csvHeader}${csvContent}`);
};

export default createCsv;
