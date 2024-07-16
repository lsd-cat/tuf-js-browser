import IndexedDB from '../../utils/indexeddb';
import "fake-indexeddb/auto";

describe('IndexedDB', () => {
  let db: IndexedDB;
  const DB_NAME = 'TestDB';
  const STORE_NAME = 'TestStore';

  beforeAll(() => {
    db = new IndexedDB(DB_NAME, STORE_NAME);
  });

  afterEach(async () => {
    await db.clearStore();
  });

  afterAll(async () => {
    await db.clearStore();
  });

  it('should add data to IndexedDB', async () => {
    const content = new Uint8Array([1, 2, 3, 4, 5]);
    const id = await db.add(content);
    const retrievedContent = await db.get(id);
    expect(retrievedContent).toEqual(content);
  });

  it('should update data with an existing ID', async () => {
    const initialContent = new Uint8Array([1, 2, 3, 4, 5]);
    const updatedContent = new Uint8Array([6, 7, 8, 9, 0]);
    const id = await db.add(initialContent);

    // Update the data with the same ID
    await db.add(updatedContent, id);
    const retrievedContent = await db.get(id);
    expect(retrievedContent).toEqual(updatedContent);
  });

  it('should check that data matches some random data that was added', async () => {
    const randomContent = new Uint8Array([Math.random(), Math.random(), Math.random(), Math.random(), Math.random()]);
    const id = await db.add(randomContent);
    const retrievedContent = await db.get(id);
    expect(retrievedContent).toEqual(randomContent);
  });

  it('should check that an entry exists', async () => {
    const content = new Uint8Array([15, 25, 35, 45, 55]);
    const id = await db.add(content);
    const retrievedContent = await db.get(id);
    expect(retrievedContent).toBeTruthy();
    expect(retrievedContent).toEqual(content);
  });

  it('should delete entries successfully', async () => {
    const content = new Uint8Array([5, 10, 15, 20, 25]);
    const id = await db.add(content);

    // Verify the entry exists
    let retrievedContent = await db.get(id);
    expect(retrievedContent).toEqual(content);

    // Delete the entry
    await db.delete(id);

    // Verify the entry no longer exists
    retrievedContent = await db.get(id);
    expect(retrievedContent).toBeUndefined();
  });
});