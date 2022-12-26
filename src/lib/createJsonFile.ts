import fs from 'fs';

const createJsonFile = ({
  content,
  outputPath,
}: {
  content: any;
  outputPath: string;
}) => {
  fs.writeFileSync(outputPath, JSON.stringify(content, null, 2));
};

export default createJsonFile;
