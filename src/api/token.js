const _ = require('lodash');

const { getRunebaseRPCAddress } = require('../config');
const Utils = require('../utils');
const { getInstance } = require('../rclient');


function getContract(tokenAddress, abi) {
  return getInstance().Contract(tokenAddress, abi);
}

const Token = {
  async approve(args) {
    const {
      spender, // address
      value, // string: satoshi
      senderAddress, // address
      token,
      tokenAddress,
      abi,
    } = args;

    if (_.isUndefined(spender)) {
      throw new TypeError('spender needs to be defined');
    }
    if (_.isUndefined(value)) {
      throw new TypeError('value needs to be defined');
    }
    if (_.isUndefined(senderAddress)) {
      throw new TypeError('senderAddress needs to be defined');
    }
    if (_.isUndefined(token)) {
      throw new TypeError('owner needs to be defined');
    }
    if (_.isUndefined(tokenAddress)) {
      throw new TypeError('owner needs to be defined');
    }
    if (_.isUndefined(abi)) {
      throw new TypeError('owner needs to be defined');
    }

    return getContract(tokenAddress, abi).send('approve', {
      methodArgs: [spender, value],
      senderAddress,
    });
  },

  async transfer(args) {
    const {
      to, // address
      value, // string: Predoshi
      senderAddress, // address
      token,
      tokenAddress,
      abi,
      RrcVersion,
    } = args;

    if (_.isUndefined(to)) {
      throw new TypeError('to needs to be defined');
    }
    if (_.isUndefined(value)) {
      throw new TypeError('value needs to be defined');
    }
    if (_.isUndefined(senderAddress)) {
      throw new TypeError('senderAddress needs to be defined');
    }
    if (_.isUndefined(token)) {
      throw new TypeError('token needs to be defined');
    }
    if (_.isUndefined(tokenAddress)) {
      throw new TypeError('tokenAddress needs to be defined');
    }
    if (_.isUndefined(abi)) {
      throw new TypeError('abi needs to be defined');
    }
    if (_.isUndefined(RrcVersion)) {
      throw new TypeError('RrcVersion needs to be defined');
    }

    return getContract(tokenAddress, abi).send('transfer', {
      methodArgs: [to, value],
      senderAddress,
    });
  },

  async allowance(args) {
    const {
      owner, // address
      spender, // address
      senderAddress, // address
      token,
      tokenAddress,
      abi,
      RrcVersion,
    } = args;

    if (_.isUndefined(owner)) {
      throw new TypeError('owner needs to be defined');
    }
    if (_.isUndefined(spender)) {
      throw new TypeError('spender needs to be defined');
    }
    if (_.isUndefined(senderAddress)) {
      throw new TypeError('senderAddress needs to be defined');
    }
    if (_.isUndefined(token)) {
      throw new TypeError('token needs to be defined');
    }
    if (_.isUndefined(tokenAddress)) {
      throw new TypeError('tokenAddress needs to be defined');
    }
    if (_.isUndefined(abi)) {
      throw new TypeError('abi needs to be defined');
    }
    if (_.isUndefined(RrcVersion)) {
      throw new TypeError('RrcVersion needs to be defined');
    }

    const res = await getContract(tokenAddress, abi).call('allowance', {
      methodArgs: [owner, spender],
      senderAddress,
    });
    res[0] = Utils.hexToDecimalString(res[0]);
    res.remaining = Utils.hexToDecimalString(res.remaining);
    return res;
  },

  async balanceOf(args) {
    const {
      owner, // address
      senderAddress, // address
      token,
      tokenAddress,
      abi,
    } = args;

    if (_.isUndefined(owner)) {
      throw new TypeError('owner needs to be defined');
    }
    if (_.isUndefined(senderAddress)) {
      throw new TypeError('senderAddress needs to be defined');
    }
    if (_.isUndefined(token)) {
      throw new TypeError('token needs to be defined');
    }
    if (_.isUndefined(tokenAddress)) {
      throw new TypeError('tokenAddress needs to be defined');
    }
    if (_.isUndefined(abi)) {
      throw new TypeError('abi needs to be defined');
    }
    const res = await getContract(tokenAddress, abi).call('balanceOf', {
      methodArgs: [owner],
      senderAddress,
    });
    res[0] = Utils.hexToDecimalString(res[0]);
    res.balance = Utils.hexToDecimalString(res.executionResult.formattedOutput.balance);
    return res;
  },
};

module.exports = Token;
