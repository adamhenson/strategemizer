import archiver from 'archiver';
import fs from 'fs';

const archiveDirectory = (directoryPath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const directoryName = directoryPath.substring(
      directoryPath.lastIndexOf('/') + 1,
    );
    const outputPath = directoryPath.replace(
      directoryName,
      `${directoryName}.zip`,
    );
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Sets the compression level.
    });

    // listen for all archive data to be written
    // 'close' event is fired only when a file descriptor is involved
    output.on('close', function () {
      console.log(archive.pointer() + ' total bytes');
      console.log(
        'archiver has been finalized and the output file descriptor has closed.',
      );
      try {
        fs.rmSync(directoryPath, { recursive: true });
      } catch (error) {
        reject(error);
        return;
      }
      resolve(outputPath);
    });

    // This event is fired when the data source is drained no matter what was the data source.
    // It is not part of this library but rather from the NodeJS Stream API.
    // @see: https://nodejs.org/api/stream.html#stream_event_end
    output.on('end', function () {
      console.log('Data has been drained');
    });

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function (error) {
      if (error.code === 'ENOENT') {
        console.warn(error.code);
      } else {
        reject(error);
      }
    });

    // good practice to catch this error explicitly
    archive.on('error', function (error) {
      reject(error);
    });

    // pipe archive data to the file
    archive.pipe(output);

    // append files from a sub-directory, putting its contents at the root of archive
    archive.directory(directoryPath, false);

    // finalize the archive (ie we are done appending files but streams have to finish yet)
    // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
    archive.finalize();
  });

export default archiveDirectory;
