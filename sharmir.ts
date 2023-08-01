import BigNumber from 'bignumber.js';
import { Point, PointWithEncryptedState } from '@utils/data-format';
import { encryptString, arrayBufferToBase64, base64ToArrayBuffer, decryptString } from './keypair';

/*
This function generates a random BigNumber within the range of min and max (inclusive), using the browser's crypto.getRandomValues() function.

inputs:
min (BigNumber): the lower bound of the range (inclusive)
max (BigNumber): the upper bound of the range (inclusive). If null is passed, then min is used as the upper bound and 0 is used as the lower bound.

outputs:
A randomly generated BigNumber within the given range.
*/
function getRandomBigNumber(min: BigNumber, max: BigNumber) {
  let bigMax = new BigNumber(0);
  let bigMin = new BigNumber(0);

  if (max == null) {
    bigMax = new BigNumber(min);
    bigMin = new BigNumber(0);
  } else {
    bigMax = new BigNumber(max);
    bigMin = new BigNumber(min);
  }

  const range = bigMax.minus(bigMin).plus(1);
  const bytesNeeded = Math.ceil((range.toString(2).length + 7) / 8);
  const randomBytes = new Uint8Array(bytesNeeded);
  const crypto = window.crypto || window.Crypto;
  crypto.getRandomValues(randomBytes);
  let result = new BigNumber(0);

  for (let i = 0; i < bytesNeeded; i++) {
    result = result.plus(new BigNumber(randomBytes[i]).shiftedBy(i * 8));
  }

  return bigMin.plus(result.mod(range));
}

/*
Check if a given number is an integer greater than zero.

inputs:
num (BigNumber) - The number to check.

output:
(boolean) - Whether the number is an integer greater than zero.
*/
function isIntGreaterThanZero(num: BigNumber): boolean {
  return num.isInteger() && num.isGreaterThan(BigNumber(0));
}

/*
Generate a Shamir polynomial with a given zero_value.

inputs:
zeroValue (BigNumber) - The secret value to be shared.
threshold (BigNumber) - The minimum number of shares required to reconstruct the secret.
prime (BigNumber) - The prime number to use for the polynomial modulus.
deterministic (boolean, optional) - whether to generate a deterministic polynomial (all coefficients are prime - 1) or a random polynomial. Default: false.

output:
coefs (BigNumber[]) - A list of coefficients representing the polynomial.
*/
function sampleShamirPolynomial(zeroValue: BigNumber, threshold: BigNumber, prime: BigNumber, deterministic: boolean = false): BigNumber[] {
  if (deterministic) {
    const length = threshold.minus(BigNumber(1)).toNumber();
    let coefs = [zeroValue];
    for (let i = 0; i < length; i++) {
      coefs.push(prime.minus(BigNumber(1)));
    }
    return coefs;
  }

  const length = threshold.minus(BigNumber(1)).toNumber();
  const coefs = [zeroValue, ...Array.from({ length: length }, () => getRandomBigNumber(BigNumber(1), prime))];
  return coefs;
}

/*
Evaluate the polynomial at a given point using the provided coefficients.
    
inputs:
coefs (BigNumber[]) - A list of coefficients representing the polynomial.
point (number) - The point at which to evaluate the polynomial.
prime (BigNumber) - The prime number to use for the polynomial modulus.

output:
result (BigNumber) - The result of the polynomial evaluation at the specified point, modulo the prime.
*/
function evaluateAtPoint(coefs: BigNumber[], point: number, prime: BigNumber): BigNumber {
  let result = BigNumber(0);
  const bigIntPoint = BigNumber(point);
  const reversedCoefs = [...coefs].reverse();

  for (const coef of reversedCoefs) {
    result = coef.plus(bigIntPoint.multipliedBy(result)).modulo(prime);
  }

  return result;
}

/*
Calculate the interpolated value at a given point using Lagrange's interpolation formula

inputs:
pointsValues (Array<Point>) - array of (x, y) coordinates of the points
queryXAxis (BigNumber) - x-coordinate of the point to interpolate
prime (BigNumber) - prime number used for modular arithmetic

outputs:
result (BigNumber) - interpolated value at the given x-coordinate
*/
function interpolateAtPoint(pointsValues: Array<Point>, queryXAxis: BigNumber, prime: BigNumber): BigNumber {
  const xVals = pointsValues.map(([x, _]) => (typeof x === 'string' ? new BigNumber(x) : x));
  const yVals = pointsValues.map(([_, y]) => (typeof y === 'string' ? new BigNumber(y) : y));

  const constants = lagrangeConstantsForPoint(xVals, queryXAxis, prime);
  const result = constants.reduce((acc, ci, i) => acc.plus(ci.times(yVals[i])).mod(prime), new BigNumber(0));

  return result;
}

/*
Calculate Lagrange constants for a given point using a list of points.

inputs:
points (BigNumber[]) - The list of points used to compute the Lagrange constants.
point (BigNumber) - The point for which the Lagrange constants are to be calculated.
prime (BigNumber) - The prime number used for modular arithmetic.

outputs:
number[] - Returns an array of Lagrange constants corresponding to the input points.
*/
function lagrangeConstantsForPoint(points: BigNumber[], query_x_axis: BigNumber, prime: BigNumber): BigNumber[] {
  const constants: BigNumber[] = new Array(points.length).fill(new BigNumber(0));

  for (let i = 0; i < points.length; i++) {
    const xi = new BigNumber(points[i]);
    let num = new BigNumber(1);
    let denum = new BigNumber(1);

    for (let j = 0; j < points.length; j++) {
      if (j !== i) {
        const xj = new BigNumber(points[j]);
        num = modulus(num.multipliedBy(xj.minus(query_x_axis)), prime);
        denum = modulus(denum.multipliedBy(xj.minus(xi)), prime);
      }
    }

    const a = modularInverse(denum, prime);

    if (a !== null) {
      constants[i] = modulus(num.multipliedBy(a), prime);
    } else {
      throw new Error("Inverse doesn't exist");
    }
  }

  return constants;
}

/*
Calculate modulus overriding BigNumber.modulo(), which will only return the sign if
num is negative.

inputs:
num (BigNumber) - Dividend
mod (BigNumber) - Divisor
*/
function modulus(num: BigNumber, mod: BigNumber): BigNumber {
  if (num.isLessThan(0)) {
    return num.modulo(mod).plus(mod).modulo(mod);
  }
  return num.modulo(mod);
}

/*
This function calculates the Extended Euclidean Algorithm to find the greatest common divisor (gcd) of two given 
numbers, a and b, as well as the coefficients of Bézout's identity (x, y), which are integers such that ax + by = gcd(a, b).

inputs:
a (BigNumber) - The first number for which the gcd and Bézout's coefficients are to be calculated.
b (BigNumber) - The second number for which the gcd and Bézout's coefficients are to be calculated.

outputs:
[gcd, x, y] (Array of BigNumber) - An array containing three BigNumber elements:

gcd: The greatest common divisor of a and b.
x: The first coefficient of Bézout's identity (ax + by = gcd(a, b)).
y: The second coefficient of Bézout's identity (ax + by = gcd(a, b)).
"""
*/
function gcdExtended(a: BigNumber, b: BigNumber): [BigNumber, BigNumber, BigNumber] {
  if (a.isEqualTo(0)) {
    return [b, new BigNumber(0), new BigNumber(1)];
  }

  const [gcd, x1, y1] = gcdExtended(b.mod(a), a);
  const x = y1.minus(b.idiv(a).times(x1));
  const y = x1;

  return [gcd, x, y];
}

/*
This function calculates the modular inverse of a given number 'a' under modulo 'm'. The modular inverse 
exists only if 'a' and 'm' are coprime (i.e., their gcd is 1). The function returns the modular inverse if it 
exists, otherwise it returns null.

inputs:
a (BigNumber) - The number for which the modular inverse is to be calculated.
m (BigNumber) - The modulo value under which the inverse is to be calculated.

outputs:
modularInverse (BigNumber | null) - The modular inverse of 'a' under modulo 'm' if it exists, otherwise null.
*/
function modularInverse(a: BigNumber, m: BigNumber): BigNumber | null {
  const [gcd, x, _] = gcdExtended(a, m);

  if (!gcd.isEqualTo(1)) {
    // Modular inverse does not exist if a and m are not coprime (gcd is not 1)
    return null;
  }

  // Ensure the result is in the range [0, m)
  return x.modulo(m).plus(m).modulo(m);
}

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

/*
Split a secret into a list of shares.

inputs:
secret (BigNumber) - The secret to be shared.
numShares (number) - The number of shares to generate.
threshold (BigNumber) - The minimum number of shares required to reconstruct the secret.
asString (boolean, optional) - Whether to return the shares as strings. Default: false.
prime (BigNumber, optional) - The prime number to use for the polynomial modulus. Default: BigNumber(180252380737439).

output:
shares (Point[]) - A list of tuples containing the x and y values of the shares.
*/
export function shamirShare(secret: BigNumber, numShares: number, threshold: BigNumber, asString: boolean = false, prime: BigNumber = BigNumber(180252380737439)): Point[] {
  if (!isIntGreaterThanZero(prime)) {
    throw new Error(`Prime ${prime} must be a positive integer`);
  }

  const polynomial = sampleShamirPolynomial(secret, threshold, prime);

  return Array.from({ length: numShares }, (_, i) => {
    const point: Point = [new BigNumber(i + 1), evaluateAtPoint(polynomial, i + 1, prime)];

    if (asString) {
      const x = point[0].toString();
      const y = point[1].toString();
      return [x, y];
    } else {
      return point;
    }
  });
}

/*
Encrypt a specified number of shares using a public key.

inputs:
points (Point[]) - The list of shares to be encrypted, where each share is a tuple of two numbers (x, y).
numEncryptWithKey (number) - The number of shares to be encrypted using the public key.
publicKey (CryptoKey) - The public key used for encryption.

output:
encryptedPoints (Promise<Array<Point>>) - A promise that resolves to a list of encrypted shares, where each share is a tuple 
of two values (x, encrypted_y) for the encrypted shares, or (x, y) for the unencrypted shares.
*/
export async function encryptSecretShares(points: Point[], numEncryptWithKey: number, publicKey: CryptoKey): Promise<Array<PointWithEncryptedState>> {
  let numCalls = 0;
  const encryptedPoints = new Array();

  for (let i = 0; i < points.length; i++) {
    const x = points[i][0];
    const y = points[i][1].toString();

    if (numCalls < numEncryptWithKey) {
      encryptedPoints.push([x, arrayBufferToBase64(await encryptString(publicKey, y)), 'enc-share']);
    } else {
      encryptedPoints.push([x, y, 'share']);
    }
    numCalls++;
  }

  return encryptedPoints;
}

/*
Decrypt an array of secret shares using a private key.

inputs:
encryptedShares (Array<PointWithEncryptedState>) - An array of encrypted secret shares, each represented by a tuple with x, y, and state ('enc-share' or 'plain').
privateKey (CryptoKey) - The private key used for decryption.

outputs:
Promise<Array<Point>> - A Promise that resolves to an array of decrypted secret shares, each represented by a tuple with x and y values.
*/
export async function decryptSecretShares(encryptedShares: Array<PointWithEncryptedState>, privateKey: CryptoKey): Promise<Array<Point>> {
  const decryptedShares = new Array();

  for (let i = 0; i < encryptedShares.length; i++) {
    const x = encryptedShares[i][0];
    const y = encryptedShares[i][1];
    const state = encryptedShares[i][2];

    if (state === 'enc-share') {
      decryptedShares.push([x, await decryptString(privateKey, base64ToArrayBuffer(y))]);
    } else {
      decryptedShares.push([x, y]);
    }
  }

  return decryptedShares;
}

/*
Calculate the Lagrange constants for a given point

inputs:
points (Array<Point>) - array of x-coordinates of the points
prime (BigNumber) - prime number used for modular arithmetic
queryXAxis (BigNumber) - x-coordinate of the point to interpolate

outputs:
constants (string) - String representation of the Lagrange constant
*/
export function shamirReconstruct(shares: Array<Point>, prime: BigNumber, queryXAxis: BigNumber = new BigNumber(0)): string {
  const polynomial = shares;
  const secret = interpolateAtPoint(polynomial, queryXAxis, prime);

  return secret.toString();
}