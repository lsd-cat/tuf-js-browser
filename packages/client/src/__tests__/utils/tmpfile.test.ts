import IndexedDB from '../../utils/indexeddb';
import { withTempFile,  TempFileStream, writeBufferToStream } from '../../utils/tmpfile';
import "fake-indexeddb/auto";

describe('withTempFile', () => {
  const DB_NAME = 'TUF';
  const STORE_NAME = 'TempFiles';


  it('should create a file with random content and read it back', async () => {
    const randomContent = new Uint8Array([
      Math.random(), Math.random(), Math.random(), Math.random(), Math.random()
    ]);

    await withTempFile(async (id, db) => {
      const fileStream = new TempFileStream(db, id);
      await writeBufferToStream(fileStream, Buffer.from(randomContent));
      await fileStream.close();
      
      const retrievedContent = await db.get(id);
      expect(retrievedContent).toEqual(randomContent);
    });
  });

  it('should delete the file after use', async () => {
    const randomContent = new Uint8Array([
      Math.random(), Math.random(), Math.random(), Math.random(), Math.random()
    ]);

    const fileId = await withTempFile(async (id, db) => {
      const fileStream = new TempFileStream(db, id);
      await writeBufferToStream(fileStream, Buffer.from(randomContent));
      await fileStream.close();

      const retrievedContent = await db.get(id);
      expect(retrievedContent).toEqual(randomContent);
      return id;
    });

    const db = new IndexedDB(DB_NAME, STORE_NAME);
    const retrievedContentAfter = await db.get(fileId);
    expect(retrievedContentAfter).toBeUndefined();
  });

  it('should handle nested withTempFile calls', async () => {
    const content1 = new Uint8Array([
      Math.random(), Math.random(), Math.random()
    ]);
    const content2 = new Uint8Array([
      Math.random(), Math.random(), Math.random()
    ]);

    await withTempFile(async (id1, db1) => {
      const fileStream1 = new TempFileStream(db1, id1);
      await writeBufferToStream(fileStream1, Buffer.from(content1));
      await fileStream1.close();
      
      const retrievedContent1 = await db1.get(id1);
      expect(retrievedContent1).toEqual(content1);

      await withTempFile(async (id2, db2) => {
        const fileStream2 = new TempFileStream(db2, id2);
        await writeBufferToStream(fileStream2, Buffer.from(content2));
        await fileStream2.close();
        
        const retrievedContent2 = await db2.get(id2);
        expect(retrievedContent2).toEqual(content2);

        // Both files should exist at the same time
        const retrievedContent1Again = await db1.get(id1);
        expect(retrievedContent1Again).toEqual(content1);
      });
    });

    // Verify both files are deleted after the handlers return
    const db = new IndexedDB(DB_NAME, STORE_NAME);
    const retrievedContentAfter1 = await db.get('id1');
    const retrievedContentAfter2 = await db.get('id2');
    expect(retrievedContentAfter1).toBeUndefined();
    expect(retrievedContentAfter2).toBeUndefined();
  });
});