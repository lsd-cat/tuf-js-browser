import { stringToUint8Array, uint8ArrayConcat } from './encoding';

class Hash {
  private algorithm: "SHA-256" | "SHA-384" | "SHA-512";
  private value: ArrayBuffer;

  constructor(algorithm: string) {
      if (algorithm.includes("512")) {
        this.algorithm = "SHA-512";
      } else if (algorithm.includes("384")) {
        this.algorithm = "SHA-384";
      } else {
        this.algorithm = "SHA-256";
      }
      this.value = new Uint8Array(0);
  }

  update(data: Uint8Array): void {
      if (typeof data === 'string') {
          data = stringToUint8Array(data);
      }

      this.value = uint8ArrayConcat([new Uint8Array(this.value), data]);
  }

  async digest(): Promise<Uint8Array> {
    // This should fail if called multiple times; we can't care right now
    return new Uint8Array(await crypto.subtle.digest(this.algorithm, this.value));
  }
}

function createHash(algorithm: string): Hash {
  return new Hash(algorithm);
}

export type { Hash };

export default {
    Hash,
    createHash
};
  