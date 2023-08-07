<template>
  <div class="content">
    <h1>Shamir's Secret Sharing with Asymmetric Encryption Demo</h1>
    <h2>Key Generation</h2>
    <div v-if="loading">Generating keys...</div>
    <div v-else>
      <p><strong>Public Key:</strong></p>
      <pre>{{ publicKeyString }}</pre>
      <p><strong>Private Key:</strong></p>
      <pre>{{ privateKeyString }}</pre>
    </div>

    <h2>Encrypt Tabular Data</h2>

    <div class="input-section">
      <label>Enter Table (JSON format):</label>
      <textarea v-model="tableJson" rows="5"></textarea>
    </div>

    <div class="input-section">
      <label>Number of Shares:</label>
      <input v-model="numShares" type="number" />
    </div>

    <div class="input-section">
      <label>Threshold:</label>
      <input v-model="threshold" type="number" />
    </div>

    <div class="input-section">
      <label>Number of Shares to Encrypt:</label>
      <input v-model="numEncryptWithKey" type="number" />
    </div>

    <div>
      <button @click="shareTable">Share Table</button>
    </div>

    <div v-if="encryptedShares">
      <h2>Encrypted Shares:</h2>
      <pre>{{ encryptedShares }}</pre>
    </div>

    <div>
      <button @click="reconstructTable">Reconstruct Table</button>
    </div>

    <div v-if="reconstructedTable">
      <h2>Reconstructed Table:</h2>
      <pre>{{ reconstructedTable }}</pre>
    </div>
  </div>
</template>

<script>
import { tableToSecretShares, secretSharesToTable } from '../../../src/shamir';
import { keyPairToDictionary, generateKeyPair } from '../../../src/keypair';
import { BigNumber } from 'bignumber.js';

export default {
  data() {
    return {
      tableJson: this.generateRandomTable(3, 5),
      numShares: 4,
      threshold: 3,
      numEncryptWithKey: 4,
      encryptedShares: {},
      publicKey: null,
      privateKey: null,
      publicKeyString: '',
      privateKeyString: '',
      reconstructedTable: {},
      prime: 180252380737439,
    };
  },
  async created() {
    try {
      const keyPair = await generateKeyPair();
      this.publicKey = keyPair.publicKey;
      this.privateKey = keyPair.privateKey;
      const { publicKey, privateKey } = await keyPairToDictionary(keyPair);
      this.publicKeyString = publicKey;
      this.privateKeyString = privateKey;
    } catch (error) {
      console.error('Error generating key pair:', error);
    }
  },
  methods: {
    generateRandomTable(height, width) {
      const table = {};

      for (let i = 0; i < height; i++) {
        const row = [];

        for (let j = 0; j < width; j++) {
          const cellValue = Math.floor(Math.random() * 100) + 1;
          row.push(cellValue);
        }

        table[`row${i}`] = row;
      }

      return JSON.stringify([table]);
    },
    async createKeyPair() {
      try {
        const keyPair = await generateKeyPair();
        return keyPair;
      } catch (error) {
        console.error('Error generating key pair:', error);
        throw error;
      }
    },
    async shareTable() {
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
      // the other parties must also know the prime number used to generate the shares.
    },
    async reconstructTable() {
      try {
        const prime = new BigNumber(this.prime);
        const reduce = (value) => value;
        const progressBar = (value) => {};
        const transform = (value) => value;

        const table = await secretSharesToTable(
          this.encryptedShares,
          this.privateKey,
          prime,
          reduce,
          progressBar,
          transform
        );
        this.reconstructedTable = [table["0"]];
      } catch (error) {
        console.error('Error reconstructing the table:', error);
      }
    }
  },
};
</script>

<style scoped>
input {
  height: 1.5em;
  width: 100%;
}

textarea {
  width: 480px;
}

button {
  margin: 1em 0;
  height: 2em;
  width: inherit;
  border-radius: 4px;
}

label {
  font-weight: 600;
}

.content {
  display: column;
  flex-direction: start;
  justify-content: center;
}

.input-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 480px;
  margin: 0 auto;
}

.shares {
  width: 480px;
}
</style>