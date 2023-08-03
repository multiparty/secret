import { BigNumber } from 'bignumber.js';


function canBeSerialized(data: any): boolean {
    // Check primitives: number, string, boolean
    if (typeof data === 'number' || typeof data === 'string' || typeof data === 'boolean') {
      return true;
    }
    
    // Reject functions, Date objects, and undefined
    if (typeof data === 'function' || data instanceof Date || data === undefined) {
      return false;
    }
  
    // Check arrays
    if (Array.isArray(data)) {
      return data.every(item => canBeSerialized(item));
    }
  
    // Check plain objects
    if (data !== null && typeof data === 'object') {
      return Object.values(data).every(value => canBeSerialized(value));
    }
  
    // Reject all other data types
    return false;
}


function serialize(data: any): string {
    if (!canBeSerialized(data)) {
        throw new Error('Cannot serialize data');
    }

    return JSON.stringify(data);
}


function stringToBinary(input: string): string {
    let binary = '';
    for (let i = 0; i < input.length; i++) {
        const bin = input[i].charCodeAt(0).toString(2);
        binary += ('00000000' + bin).slice(-8); // Ensure each byte is 8 bits
    }
    return binary;
}


function binaryToBigNumber(binary: string): BigNumber {
    return new BigNumber(binary, 2); // The second parameter is the base of the input number
}

export function toBigNumber(data: any): BigNumber {
    const serialized = serialize(data);
    const binary = stringToBinary(serialized);
    return binaryToBigNumber(binary);
}
