const _ = require('lodash');
const crypto = require('crypto');

const { blockchainEnv } = require('../constants');
const mainnetMetadata = require('./mainnet/contract_metadata');
const testnetMetadata = require('./testnet/contract_metadata');

const EXPLORER_TESTNET = 'https://testnet.runebase.io';
const EXPLORER_MAINNET = 'https://explorer.runebase.io';

const Config = {
  HOSTNAME: '127.0.0.1',
  PORT: 8989,
  RPC_USER: 'runebaseexchange',
  RPC_PORT_TESTNET: 19432,
  RPC_PORT_MAINNET: 9432,
  DEFAULT_LOGLVL: 'debug',
  CONTRACT_VERSION_NUM: 0,
  TRANSFER_MIN_CONFIRMATIONS: 1,
  DEFAULT_GAS_LIMIT: 250000,
  DEFAULT_GAS_PRICE: 0.0000004,
  UNLOCK_SECONDS: 604800,
};
const rpcPassword = getRandomPassword(); // Generate random password for every session

let runebaseEnv; // Runebased environment var: testnet/mainnet
let runebasePath; // Path to Runebase executables

function setRunebaseEnv(env, path) {
  if (_.isEmpty(env)) {
    throw Error('env cannot be empty.');
  }
  if (_.isEmpty(path)) {
    throw Error('path cannot be empty.');
  }
  if (runebaseEnv) {
    throw Error('runebaseEnv was already set.');
  }
  if (runebasePath) {
    throw Error('runebasePath was already set.');
  }

  runebaseEnv = env;
  runebasePath = path;
  console.log(`Environment: ${runebaseEnv}`);
  console.log(`Runebase Path: ${runebasePath}`);
}

function getRunebaseEnv() {
  return runebaseEnv;
}

function getRunebasePath() {
  return runebasePath;
}

function isMainnet() {
  // Throw an error to ensure no code is using this check before it is initialized
  if (!runebaseEnv) {
    throw Error('runebaseEnv not initialized yet before checking env');
  }

  return runebaseEnv === blockchainEnv.MAINNET;
}

function getRPCPassword() {
  let password = rpcPassword;
  _.each(process.argv, (arg) => {
    if (_.includes(arg, '-rpcpassword')) {
      password = (_.split(arg, '=', 2))[1];
    }
  });

  return password;
}

function getRunebaseRPCAddress() {
  const port = isMainnet() ? Config.RPC_PORT_MAINNET : Config.RPC_PORT_TESTNET;
  return `http://${Config.RPC_USER}:${getRPCPassword()}@localhost:${port}`;
}

function getRunebaseExplorerUrl() {
  return isMainnet() ? EXPLORER_MAINNET : EXPLORER_TESTNET;
}

/*
* Gets the smart contract metadata based on version and environment.
* @param versionNum {Number} The version number of the contracts to get, ie. 0, 1, 2.
* @param testnet {Boolean} Whether on testnet env or not.
* @return {Object} The contract metadata.
*/
async function getContractMetadata(versionNum = Config.CONTRACT_VERSION_NUM) {
  if (!_.isNumber(versionNum)) {
    throw new Error('Must supply a version number');
  }

  if (isMainnet()) {
    return mainnetMetadata[versionNum];
  }
  return testnetMetadata[versionNum];
}

/*
* Creates a randomized RPC password.
* Protects against external RPC attacks when the username/password are already known: runebaseexchange/runebaseexchange.
* @return {String} Randomized password.
*/
function getRandomPassword() {
  return crypto.randomBytes(5).toString('hex');
}

module.exports = {
  Config,
  setRunebaseEnv,
  getRunebaseEnv,
  getRunebasePath,
  isMainnet,
  getRPCPassword,
  getRunebaseRPCAddress,
  getRunebaseExplorerUrl,
  getContractMetadata,
};
