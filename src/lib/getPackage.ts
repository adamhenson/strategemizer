import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const getPackage = (): Promise<any> => {
  const filePath = fileURLToPath(
    new URL('../../package.json', import.meta.url),
  );
  return fs.readFile(filePath, 'utf8');
};

export default getPackage;
