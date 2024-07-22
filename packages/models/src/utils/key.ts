import crypto, { KeyObject, VerifyKeyObjectInput } from 'crypto';
import { CryptoError, UnsupportedAlgorithmError } from '../error';
import { encodeOIDString } from './oid';
import { hexToUint8Array, uint8ArrayConcat } from './encoding';

const ASN1_TAG_SEQUENCE = 0x30;
const ANS1_TAG_BIT_STRING = 0x03;
const NULL_BYTE = 0x00;

const OID_EDDSA = '1.3.101.112';
const OID_EC_PUBLIC_KEY = '1.2.840.10045.2.1';
const OID_EC_CURVE_P256V1 = '1.2.840.10045.3.1.7';

const PEM_HEADER = '-----BEGIN PUBLIC KEY-----';

interface KeyInfo {
  keyType: string;
  scheme: string;
  keyVal: string;
}

export function getPublicKey(keyInfo: KeyInfo): VerifyKeyObjectInput {
  switch (keyInfo.keyType) {
    case 'rsa':
      return getRSAPublicKey(keyInfo);
    case 'ed25519':
      return getED25519PublicKey(keyInfo);
    case 'ecdsa':
    case 'ecdsa-sha2-nistp256':
    case 'ecdsa-sha2-nistp384':
      return getECDCSAPublicKey(keyInfo);
    default:
      throw new UnsupportedAlgorithmError(
        `Unsupported key type: ${keyInfo.keyType}`
      );
  }
}

function getRSAPublicKey(keyInfo: KeyInfo): VerifyKeyObjectInput {
  // Only support PEM-encoded RSA keys
  if (!keyInfo.keyVal.startsWith(PEM_HEADER)) {
    throw new CryptoError('Invalid key format');
  }

  const key = crypto.createPublicKey(keyInfo.keyVal);

  switch (keyInfo.scheme) {
    case 'rsassa-pss-sha256':
      return {
        key: key,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      };
    default:
      throw new UnsupportedAlgorithmError(
        `Unsupported RSA scheme: ${keyInfo.scheme}`
      );
  }
}

function getED25519PublicKey(keyInfo: KeyInfo): VerifyKeyObjectInput {
  let key: KeyObject;
  // If key is already PEM-encoded we can just parse it
  if (keyInfo.keyVal.startsWith(PEM_HEADER)) {
    key = crypto.createPublicKey(keyInfo.keyVal);
  } else {
    // If key is not PEM-encoded it had better be hex
    if (!isHex(keyInfo.keyVal)) {
      throw new CryptoError('Invalid key format');
    }

    key = crypto.createPublicKey({
      key: Buffer.from(ed25519.hexToDER(keyInfo.keyVal)),
      format: 'der',
      type: 'spki',
    });
  }

  return { key };
}

function getECDCSAPublicKey(keyInfo: KeyInfo): VerifyKeyObjectInput {
  let key: KeyObject;
  // If key is already PEM-encoded we can just parse it
  if (keyInfo.keyVal.startsWith(PEM_HEADER)) {
    key = crypto.createPublicKey(keyInfo.keyVal);
  } else {
    // If key is not PEM-encoded it had better be hex
    if (!isHex(keyInfo.keyVal)) {
      throw new CryptoError('Invalid key format');
    }

    key = crypto.createPublicKey({
      key: Buffer.from(ecdsa.hexToDER(keyInfo.keyVal)),
      format: 'der',
      type: 'spki',
    });
  }

  return { key };
}

const ed25519 = {
  // Translates a hex key into a crypto KeyObject
  // https://keygen.sh/blog/how-to-use-hexadecimal-ed25519-keys-in-node/
  hexToDER: (hex: string): Uint8Array => {
    const key = hexToUint8Array(hex);
    const oid = encodeOIDString(OID_EDDSA);

    // Create a byte sequence containing the OID and key
    const elements = uint8ArrayConcat([
      uint8ArrayConcat([
        new Uint8Array([ASN1_TAG_SEQUENCE]),
        new Uint8Array([oid.length]),
        oid,
      ]),
      uint8ArrayConcat([
        new Uint8Array([ANS1_TAG_BIT_STRING]),
        new Uint8Array([key.length + 1]),
        new Uint8Array([NULL_BYTE]),
        key,
      ]),
    ]);

    // Wrap up by creating a sequence of elements
    const der = uint8ArrayConcat([
      new Uint8Array([ASN1_TAG_SEQUENCE]),
      new Uint8Array([elements.length]),
      elements,
    ]);

    return der;
  },
};

const ecdsa = {
  hexToDER: (hex: string): Uint8Array => {
    const key = hexToUint8Array(hex);
    const bitString = uint8ArrayConcat([
      new Uint8Array([ANS1_TAG_BIT_STRING]),
      new Uint8Array([key.length + 1]),
      new Uint8Array([NULL_BYTE]),
      key,
    ]);

    const oids = uint8ArrayConcat([
      encodeOIDString(OID_EC_PUBLIC_KEY),
      encodeOIDString(OID_EC_CURVE_P256V1),
    ]);

    const oidSequence = uint8ArrayConcat([
      new Uint8Array([ASN1_TAG_SEQUENCE]),
      new Uint8Array([oids.length]),
      oids,
    ]);

    // Wrap up by creating a sequence of elements
    const der = uint8ArrayConcat([
      new Uint8Array([ASN1_TAG_SEQUENCE]),
      new Uint8Array([oidSequence.length + bitString.length]),
      oidSequence,
      bitString,
    ]);

    return der;
  },
};

const isHex = (key: string): boolean => /^[0-9a-fA-F]+$/.test(key);
