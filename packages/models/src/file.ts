import crypto, { Hash } from './utils/crypto';
import { uint8ArrayToHex } from './utils/encoding';
import util from 'util';
import { LengthOrHashMismatchError, ValueError } from './error';
import { guard, JSONObject, JSONValue } from './utils';


interface MetaFileOptions {
  version: number;
  length?: number;
  hashes?: Record<string, string>;
  unrecognizedFields?: Record<string, JSONValue>;
}

// A container with information about a particular metadata file.
//
// This class is used for Timestamp and Snapshot metadata.
export class MetaFile {
  readonly version: number;
  readonly length?: number;
  readonly hashes?: Record<string, string>;
  readonly unrecognizedFields?: Record<string, JSONValue>;

  constructor(opts: MetaFileOptions) {
    if (opts.version <= 0) {
      throw new ValueError('Metafile version must be at least 1');
    }

    if (opts.length !== undefined) {
      validateLength(opts.length);
    }

    this.version = opts.version;
    this.length = opts.length;
    this.hashes = opts.hashes;
    this.unrecognizedFields = opts.unrecognizedFields || {};
  }

  public equals(other: MetaFile): boolean {
    if (!(other instanceof MetaFile)) {
      return false;
    }

    return (
      this.version === other.version &&
      this.length === other.length &&
      util.isDeepStrictEqual(this.hashes, other.hashes) &&
      util.isDeepStrictEqual(this.unrecognizedFields, other.unrecognizedFields)
    );
  }

  public async verify(data: Uint8Array): Promise<void> {
    // Verifies that the given data matches the expected length.
    if (this.length !== undefined) {
      if (data.length !== this.length) {
        throw new LengthOrHashMismatchError(
          `Expected length ${this.length} but got ${data.length}`
        );
      }
    }

    // Verifies that the given data matches the supplied hashes.
    if (this.hashes) {
      const hashEntries = Object.entries(this.hashes);
    
      await Promise.all(hashEntries.map(async ([key, value]) => {
        let hash: Hash;
    
        try {
          hash = crypto.createHash(key);
        } catch (e) {
          throw new LengthOrHashMismatchError(
            `Hash algorithm ${key} not supported`
          );
        }
        hash.update(data);
        const observedHash = uint8ArrayToHex(await hash.digest());
    
        if (observedHash !== value) {
          throw new LengthOrHashMismatchError(
            `Expected hash ${value} but got ${observedHash}`
          );
        }
      }));
    }
  }

  public toJSON(): JSONObject {
    const json: JSONObject = {
      version: this.version,
      ...this.unrecognizedFields,
    };

    if (this.length !== undefined) {
      json.length = this.length;
    }

    if (this.hashes) {
      json.hashes = this.hashes;
    }

    return json;
  }

  public static fromJSON(data: JSONObject): MetaFile {
    const { version, length, hashes, ...rest } = data;

    if (typeof version !== 'number') {
      throw new TypeError('version must be a number');
    }

    if (guard.isDefined(length) && typeof length !== 'number') {
      throw new TypeError('length must be a number');
    }

    if (guard.isDefined(hashes) && !guard.isStringRecord(hashes)) {
      throw new TypeError('hashes must be string keys and values');
    }

    return new MetaFile({
      version,
      length,
      hashes,
      unrecognizedFields: rest,
    });
  }
}

interface TargetFileOptions {
  length: number;
  path: string;
  hashes: Record<string, string>;
  unrecognizedFields?: Record<string, JSONValue>;
}

// Container for info about a particular target file.
//
// This class is used for Target metadata.
export class TargetFile {
  readonly length: number;
  readonly path: string;
  readonly hashes: Record<string, string>;
  readonly unrecognizedFields: Record<string, JSONValue>;

  constructor(opts: TargetFileOptions) {
    validateLength(opts.length);

    this.length = opts.length;
    this.path = opts.path;
    this.hashes = opts.hashes;
    this.unrecognizedFields = opts.unrecognizedFields || {};
  }

  get custom(): Record<string, unknown> {
    const custom = this.unrecognizedFields['custom'];
    if (!custom || Array.isArray(custom) || !(typeof custom === 'object')) {
      return {};
    }
    return custom;
  }

  public equals(other: TargetFile): boolean {
    if (!(other instanceof TargetFile)) {
      return false;
    }

    return (
      this.length === other.length &&
      this.path === other.path &&
      util.isDeepStrictEqual(this.hashes, other.hashes) &&
      util.isDeepStrictEqual(this.unrecognizedFields, other.unrecognizedFields)
    );
  }

  public async verify(stream: ReadableStream<Uint8Array>): Promise<void> {
    let observedLength = 0;
  
    // Create a digest for each hash algorithm
    const digests = Object.keys(this.hashes).reduce(
      (acc, key) => {
        try {
          acc[key] = crypto.createHash(key);
        } catch (e) {
          throw new LengthOrHashMismatchError(
            `Hash algorithm ${key} not supported`
          );
        }
        return acc;
      },
      {} as Record<string, Hash>
    );
  
    // Create a reader to read from the stream
    const reader = stream.getReader();
  
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        // Keep running tally of stream length
        observedLength += value.length;
  
        // Append chunk to each digest
        Object.values(digests).forEach((digest) => {
          digest.update(value);
        });
      }
    }
  
    // Verify length matches expected value
    if (observedLength !== this.length) {
      throw new LengthOrHashMismatchError(
        `Expected length ${this.length} but got ${observedLength}`
      );
    }
  
    // Verify each digest matches expected value
    const digestEntries = Object.entries(digests);
  
    await Promise.all(digestEntries.map(async ([key, value]) => {
      const expected = this.hashes[key];
      const actual = uint8ArrayToHex(await value.digest());
  
      if (actual !== expected) {
        throw new LengthOrHashMismatchError(
          `Expected hash ${expected} but got ${actual}`
        );
      }
    }));
  }

  public toJSON(): JSONObject {
    return {
      length: this.length,
      hashes: this.hashes,
      ...this.unrecognizedFields,
    };
  }

  public static fromJSON(path: string, data: JSONObject): TargetFile {
    const { length, hashes, ...rest } = data;

    if (typeof length !== 'number') {
      throw new TypeError('length must be a number');
    }

    if (!guard.isStringRecord(hashes)) {
      throw new TypeError('hashes must have string keys and values');
    }

    return new TargetFile({
      length,
      path,
      hashes,
      unrecognizedFields: rest,
    });
  }
}

// Check that supplied length if valid
function validateLength(length: number): void {
  if (length < 0) {
    throw new ValueError('Length must be at least 0');
  }
}
