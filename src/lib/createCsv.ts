import fs from 'fs';
import path from 'path';
import createDirectory from './createDirectory';

type Content = string | number;

const createCsv = ({
  content,
  directory,
  filename,
  header,
}: {
  content: Content[][];
  directory: string;
  filename: string;
  header: Content[];
}) => {
  createDirectory(directory);
  const outputPath = path.resolve(`${directory}/${filename}`);
  const csvHeader = `${header.join(',')}\n`;
  const csvContent = content.map((row) => `${row.join(',')}`).join('\n');
  fs.writeFileSync(outputPath, `${csvHeader}${csvContent}`);
};

export default createCsv;
