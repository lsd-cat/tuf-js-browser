export function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);
  
    for (let i = 0; i < length; i++) {
        bytes[i] = binaryString.charCodeAt(i);  // Convert binary string to byte array
    }
  
    return bytes;
  }
  
  export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binaryString = '';
    
    for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
    }
  
    return btoa(binaryString);
  }
  
  export function hexToUint8Array(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
        throw new Error('Hex string must have an even length');
    }
  
    const length = hex.length / 2;
    const uint8Array = new Uint8Array(length);
  
    for (let i = 0; i < length; i++) {
        uint8Array[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
  
    return uint8Array;
  }
  
   export function uint8ArrayToHex(uint8Array: Uint8Array): string {
    let hexString = '';
    
    for (let i = 0; i < uint8Array.length; i++) {
        let hex = uint8Array[i].toString(16);
        if (hex.length === 1) {
            hex = '0' + hex;
        }
        hexString += hex;
    }
  
    return hexString;
  }
  
  export function stringToUint8Array(str: string): Uint8Array {
    // Defaults to utf-8, but utf-8 is ascii compatible
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }
  
  // This is silly, but it is a hack to be consistent with the original test suite
  export function uint8ArrayToString(uint8Array: Uint8Array): string {
    const decoder = new TextDecoder("ascii");
    return decoder.decode(uint8Array);
  }
  
  export function base64Encode(str: string): string {
    return uint8ArrayToBase64(stringToUint8Array(str));
  }
  
  export function base64Decode(str: string): string {
    return uint8ArrayToString(base64ToUint8Array(str));
  }

  export function uint8ArrayConcat(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);

  const result = new Uint8Array(totalLength);

  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
  }