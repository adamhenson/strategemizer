import fs from 'fs';
import path from 'path';
import createDirectory from './createDirectory';

const createJsonFile = ({
  content,
  directory,
  filename,
}: {
  content: any;
  directory: string;
  filename: string;
}) => {
  createDirectory(directory);
  const outputPath = path.resolve(`${directory}/${filename}`);
  fs.writeFileSync(outputPath, JSON.stringify(content, null, 2));
};

export default createJsonFile;
