import { canonicalize } from '@tufjs/canonical-json';
import crypto from 'crypto';
import { JSONObject } from '../utils/types';
import { hexToUint8Array } from './encoding';

export const verifySignature = (
  metaDataSignedData: JSONObject,
  key: crypto.VerifyKeyObjectInput,
  signature: string
): boolean => {
  const canonicalData = new TextEncoder().encode(canonicalize(metaDataSignedData));

  return crypto.verify(
    undefined,
    canonicalData,
    key,
    hexToUint8Array(signature)
  );
};
