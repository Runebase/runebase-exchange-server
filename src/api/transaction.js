const { Config } = require('../config');
const Utils = require('../utils');
const { db } = require('../db');

const DEFAULT_GAS_COST = formatGasCost(Config.DEFAULT_GAS_LIMIT * Config.DEFAULT_GAS_PRICE);

function getApproveObj(token, amount) {
  return {
    type: 'approve',
    gasLimit: Config.DEFAULT_GAS_LIMIT,
    gasCost: DEFAULT_GAS_COST,
    token,
    amount,
  };
}

function formatGasCost(gasCost) {
  return gasCost.toFixed(2);
}

const Transaction = {
  // Returns the transaction cost(s) and gas usage for an action
  async transactionCost(args) {
    const {
      type, // string
      token, // string
      amount, // number
      senderAddress, // address
    } = args;

    // args validation
    if (!type) {
      throw new TypeError('type needs to be defined');
    }
    if (!senderAddress) {
      throw new TypeError('senderAddress needs to be defined');
    }
    if ((type === 'TRANSFER'
      || type === 'CANCELORDER'
      || type === 'EXECUTEORDER'
      || type === 'BUYORDER'
      || type === 'SELLORDER'
      || type === 'WITHDRAWEXCHANGE'
      || type === 'DEPOSITEXCHANGE')
      && (!token || !amount)) {
      throw new TypeError('token and amount need to be defined');
    }
    // Skip approve if enough allowance
    const txType = type;

    const costsArr = [];

    // if (txType.startsWith('APPROVE')) {
    //  costsArr.push(getApproveObj(token, amount));
    // }
    const newAmount = await Utils.ConvertTokenDecimalToNormal(db, amount, token);

    switch (txType) {
      case 'TRANSFER': {
        costsArr.push({
          type: 'transfer',
          gasLimit: Config.DEFAULT_GAS_LIMIT,
          gasCost: DEFAULT_GAS_COST,
          token,
          amount: newAmount,
        });
        break;
      }
      case 'WITHDRAWEXCHANGE': {
        costsArr.push({
          type: 'withdrawExchange',
          gasLimit: Config.DEFAULT_GAS_LIMIT,
          gasCost: DEFAULT_GAS_COST,
          token,
          amount: newAmount,
        });
        break;
      }
      case 'DEPOSITEXCHANGE': {
        costsArr.push({
          type: 'depositExchange',
          gasLimit: Config.DEFAULT_GAS_LIMIT,
          gasCost: DEFAULT_GAS_COST,
          token,
          amount: newAmount,
        });
        break;
      }
      case 'EXECUTEORDER': {
        costsArr.push({
          type: 'executeOrder',
          gasLimit: Config.DEFAULT_GAS_LIMIT,
          gasCost: DEFAULT_GAS_COST,
          token,
          amount: newAmount,
        });
        break;
      }
      case 'CANCELORDER': {
        costsArr.push({
          type: 'cancelOrder',
          gasLimit: Config.DEFAULT_GAS_LIMIT,
          gasCost: DEFAULT_GAS_COST,
          token,
          amount: newAmount,
        });
        break;
      }
      case 'BUYORDER': {
        costsArr.push({
          type: 'buyOrder',
          gasLimit: Config.DEFAULT_GAS_LIMIT,
          gasCost: DEFAULT_GAS_COST,
          token,
          amount: newAmount,
        });
        break;
      }
      case 'SELLORDER': {
        costsArr.push({
          type: 'sellOrder',
          gasLimit: Config.DEFAULT_GAS_LIMIT,
          gasCost: DEFAULT_GAS_COST,
          token,
          amount: newAmount,
        });
        break;
      }
      default: {
        throw new Error(`Invalid transactionType: ${txType}`);
      }
    }
    return costsArr;
  },
};

module.exports = Transaction;
