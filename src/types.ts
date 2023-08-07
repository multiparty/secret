import BigNumber from 'bignumber.js';

export type Point = [BigNumber | string, BigNumber | string];
export type PointWithEncryptedState = [string, string, string];