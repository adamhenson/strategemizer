import fs from 'fs';

const createDirectory = (directory: string) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

export default createDirectory;
