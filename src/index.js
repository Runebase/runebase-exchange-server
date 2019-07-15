const _ = require('lodash');

const RunebaseExchangeServer = require('./server');
const RunebaseExchangeConfig = require('./config');
const RunebaseExchangeDb = require('./db');
const Constants = require('./constants');
const Utils = require('./utils');
const EmitterHelper = require('./utils/emitterHelper');
const { getLogger } = require('./utils/logger');
const Blockchain = require('./api/blockchain');
const RunebasePredictionToken = require('./api/runebaseprediction_token');
const FunToken = require('./api/fun_token');
const RunebaseUtils = require('./api/runebase_utils');
const Transaction = require('./api/transaction');
const Wallet = require('./api/wallet');
const Exchange = require('./api/exchange');

const { startServer } = RunebaseExchangeServer;
const { blockchainEnv } = Constants;
const { getDevRunebaseExecPath } = Utils;
if (_.includes(process.argv, '--testnet')) {
  startServer(blockchainEnv.TESTNET, getDevRunebaseExecPath());
} else if (_.includes(process.argv, '--mainnet')) {
  startServer(blockchainEnv.MAINNET, getDevRunebaseExecPath());
} else {
  console.log('testnet/mainnet flag not found. startServer() will need to be called explicitly.');
}

module.exports = {
  RunebaseExchangeServer,
  RunebaseExchangeConfig,
  RunebaseExchangeDb,
  Constants,
  Utils,
  EmitterHelper,
  getLogger,
  Blockchain,
  RunebasePredictionToken,
  FunToken,
  RunebaseUtils,
  Transaction,
  Wallet,
  Exchange,
};
