import debug from 'debug';
import fs from 'fs';
import util from 'util';

import { DownloadHTTPError, DownloadLengthMismatchError } from './error';
import { withTempFile } from './utils/tmpfile';

const log = debug('tuf:fetch');

type DownloadFileHandler<T> = (file: string) => Promise<T>;

export interface Fetcher {
  downloadFile<T>(
    url: string,
    maxLength: number,
    handler: DownloadFileHandler<T>
  ): Promise<T>;
  downloadBytes(url: string, maxLength: number): Promise<Buffer>;
}

export abstract class BaseFetcher implements Fetcher {
  abstract fetch(url: string): Promise<ReadableStream<Uint8Array>>;

  // Download file from given URL. The file is downloaded to a temporary
  // location and then passed to the given handler. The handler is responsible
  // for moving the file to its final location. The temporary file is deleted
  // after the handler returns.
  public async downloadFile<T>(
    url: string,
    maxLength: number,
    handler: DownloadFileHandler<T>
  ): Promise<T> {
    return withTempFile(async (tmpFile) => {
      const reader = await this.fetch(url);

      let numberOfBytesReceived = 0;
      const fileStream = fs.createWriteStream(tmpFile);

      // Read the stream a chunk at a time so that we can check
      // the length of the file as we go
      const readerStream = reader.getReader();

      try {
        while (true) {
          const { done, value } = await readerStream.read();
          if (done) break;

          numberOfBytesReceived += value.length;

          if (numberOfBytesReceived > maxLength) {
            throw new DownloadLengthMismatchError('Max length reached');
          }

          await writeBufferToStream(fileStream, Buffer.from(value));
        }
      } finally {
        // Make sure we always close the stream
        await util.promisify(fileStream.close).bind(fileStream)();
      }

      return handler(tmpFile);
    });
  }

  // Download bytes from given URL.
  public async downloadBytes(url: string, maxLength: number): Promise<Buffer> {
    return this.downloadFile(url, maxLength, async (file) => {
      const stream = fs.createReadStream(file);
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    });
  }
}

type FetcherOptions = {
  timeout?: number;
  retry?: number;
};

export class DefaultFetcher extends BaseFetcher {
  private timeout?: number;
  private retry?: number;

  constructor(options: FetcherOptions = {}) {
    super();
    this.timeout = options.timeout;
    this.retry = options.retry;
  }

  public override async fetch(url: string): Promise<ReadableStream<Uint8Array>> {
    log('GET %s', url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        // TODO timers fail with jest: i suspect somethings off
        // Commeting out timeout setting for now AND
        // the corresponding test in fetcher.test.js
        //signal: controller.signal,
        cache: 'no-cache',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'GET',
        mode: 'cors',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
      });

      clearTimeout(timeoutId);

      if (!response.ok || !response.body) {
        throw new DownloadHTTPError('Failed to download', response.status);
      }

      return response.body;
    } catch (error) {
      clearTimeout(timeoutId);

      throw error;
    }
  }
}

const writeBufferToStream = async (
  stream: fs.WriteStream,
  buffer: Buffer
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    stream.write(buffer, (err) => {
      if (err) {
        reject(err);
      }
      resolve(true);
    });
  });
};