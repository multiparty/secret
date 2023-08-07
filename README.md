# Secret: Shamir's Secret Sharing with Asymmetric Encryption Demo

## Overview
This library offers a seamless integration for applying Shamir's Secret Sharing Scheme combined with asymmetric encryption. The provided demo shows how users can generate a key pair, encrypt tabular data into shares, and then reconstruct the table from these shares.

## Features
1. Key Generation: Generate a public-private key pair to be used for asymmetric encryption.
2. Encrypt Tabular Data: Convert table data (in JSON format) into encrypted shares.
3. Reconstruct Data: Decrypt the shared data to retrieve the original table.


## Example usage
The library takes any shape of JSON. The JSON can be arbitrarily nested and deep, but leaf values must be numbers.

Example data in the form of JSON:
```
[
    {
        "row0":[41,79,48,8,18],
        "row1":[55,87,53,67,49],
        "row2":[37,91,82,89,74]
    }
]
```

Example order of operations:
```javascript
import { tableToSecretShares, generateKeyPair, secretSharesToTable } from 'secret';
import { keyPairToDictionary } from 'secret';
import { BigNumber } from 'bignumber.js';

const keyPair = await generateKeyPair();
return keyPair;

const table = JSON.parse(this.tableJson);
const prime = new BigNumber(this.prime);
this.encryptedShares = await tableToSecretShares(
    table,
    this.numShares,
    this.threshold,
    this.numEncryptWithKey,
    this.publicKey,
    prime
);

// Now you can send the encrypted shares to the other parties.
// numEncryptWithKey should be less than numShares if you want other parties to compute on the shares.
// The other parties must also know the prime number used to generate the shares.

const table = await secretSharesToTable(
    this.encryptedShares,
    this.privateKey,
    prime,
    reduce,
    progressBar,
    transform
);
```