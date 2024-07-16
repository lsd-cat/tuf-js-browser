import IndexedDB from './indexeddb';

export class TempFileStream {
  private db: IndexedDB;
  private fileId: string;
  private buffer: Uint8Array[];

  constructor(db: IndexedDB, fileId: string) {
    this.db = db;
    this.fileId = fileId;
    this.buffer = [];
  }

  async write(buffer: Uint8Array) {
    this.buffer.push(buffer);
    const concatenatedBuffer = this.concatenateBuffers(this.buffer);
    await this.db.add(concatenatedBuffer, this.fileId);
  }

  async close() {
    this.buffer = [];
  }

  private concatenateBuffers(buffers: Uint8Array[]): Uint8Array {
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    return result;
  }
}

export const writeBufferToStream = async (
  stream: TempFileStream,
  buffer: Uint8Array
): Promise<void> => {
  await stream.write(buffer);
};

type TempFileHandler<T> = (id: string, db: IndexedDB) => Promise<T>;

const DB_NAME = 'TUF';
const STORE_NAME = 'TempFiles';

export const withTempFile = async <T>(
  handler: TempFileHandler<T>,
  id?: string
): Promise<T> => {
  const db = new IndexedDB(DB_NAME, STORE_NAME);
  const fileId = await db.add(new Uint8Array(), id);
  try {
    return await handler(fileId, db);
  } finally {
    await db.delete(fileId);
  }
};