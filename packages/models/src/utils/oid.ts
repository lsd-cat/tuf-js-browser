const ANS1_TAG_OID = 0x06;

export function encodeOIDString(oid: string): Uint8Array {
  const parts = oid.split('.');

  // The first two subidentifiers are encoded into the first byte
  const first = parseInt(parts[0], 10) * 40 + parseInt(parts[1], 10);

  const rest: number[] = [];
  parts.slice(2).forEach((part) => {
    const bytes = encodeVariableLengthInteger(parseInt(part, 10));
    rest.push(...bytes);
  });

  const der = new Uint8Array([first, ...rest]);
  return new Uint8Array([ANS1_TAG_OID, der.length, ...der]);
}

function encodeVariableLengthInteger(value: number): number[] {
  const bytes: number[] = [];
  let mask = 0x00;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | mask);
    value >>= 7;
    mask = 0x80;
  }
  return bytes;
}
