const _ = require('lodash');
const { getInstance } = require('../rclient');

function getContract(exchangeAddress, abi) {
  return getInstance().Contract(exchangeAddress, abi);
}

const Exchange = {

  async balanceOf(args) {
    const {
      token, // address
      user, // address
      senderAddress,
      exchangeAddress,
      abi,
    } = args;
    if (_.isUndefined(user)) {
      throw new TypeError('user needs to be defined');
    }
    if (_.isUndefined(token)) {
      throw new TypeError('token needs to be defined');
    }
    if (_.isUndefined(exchangeAddress)) {
      throw new TypeError('exchangeAddress needs to be defined');
    }
    if (_.isUndefined(abi)) {
      throw new TypeError('abi needs to be defined');
    }
    return getContract(exchangeAddress, abi).call('balanceOf', {
      methodArgs: [token, user],
      senderAddress,
    });
    // res.balance = Utils.hexToDecimalString(res.executionResult.formattedOutput[0]);
    // res[0] = Utils.hexToDecimalString(res[0]);
    // return res;
  },

  async depositExchangeBaseCurrency(args) {
    const {
      exchangeAddress, // address
      amount,
      senderAddress,
      abi,
    } = args;
    if (_.isUndefined(senderAddress)) {
      throw new TypeError('senderAddress needs to be defined');
    }
    if (_.isUndefined(exchangeAddress)) {
      throw new TypeError('exchange needs to be defined');
    }
    if (_.isUndefined(amount)) {
      throw new TypeError('amount needs to be defined');
    }
    if (_.isUndefined(abi)) {
      throw new TypeError('abi needs to be defined');
    }

    const res = await getContract(exchangeAddress, abi).send('fund', {
      methodArgs: [],
      amount,
      senderAddress,
    });
    return res.txid;
  },

  async redeemExchange(args) {
    const {
      exchangeAddress, // address
      amount,
      token,
      tokenaddress,
      senderAddress,
      abi,
    } = args;
    if (_.isUndefined(senderAddress)) {
      throw new TypeError('senderAddress needs to be defined');
    }
    if (_.isUndefined(exchangeAddress)) {
      throw new TypeError('exchangeAddress needs to be defined');
    }
    if (_.isUndefined(amount)) {
      throw new TypeError('amount needs to be defined');
    }
    if (_.isUndefined(token)) {
      throw new TypeError('token needs to be defined');
    }
    if (_.isUndefined(senderAddress)) {
      throw new TypeError('senderAddress needs to be defined');
    }
    if (_.isUndefined(abi)) {
      throw new TypeError('abi needs to be defined');
    }

    const res = await getContract(exchangeAddress, abi).send('redeem', {
      methodArgs: [tokenaddress, amount],
      senderAddress,
    });
    return res.txid;
  },

  async orderExchange(args) {
    const {
      exchangeAddress, // address
      amount,
      token,
      tokenAddress,
      senderAddress,
      priceFractN,
      priceFractD,
      orderType,
      abi,
    } = args;
    if (_.isUndefined(senderAddress)) {
      throw new TypeError('senderAddress needs to be defined');
    }
    if (_.isUndefined(token)) {
      throw new TypeError('token needs to be defined');
    }
    if (_.isUndefined(exchangeAddress)) {
      throw new TypeError('exchangeAddress needs to be defined');
    }
    if (_.isUndefined(tokenAddress)) {
      throw new TypeError('tokenAddress needs to be defined');
    }
    if (_.isUndefined(amount)) {
      throw new TypeError('amount needs to be defined');
    }
    if (_.isUndefined(orderType)) {
      throw new TypeError('orderType needs to be defined');
    }
    if (_.isUndefined(priceFractN)) {
      throw new TypeError('priceFractN needs to be defined');
    }
    if (_.isUndefined(priceFractD)) {
      throw new TypeError('priceFractD needs to be defined');
    }
    if (_.isUndefined(abi)) {
      throw new TypeError('abi needs to be defined');
    }

    let res;
    if (orderType === 'buy') {
      res = await getContract(exchangeAddress, abi).send('createOrder', {
        methodArgs: ['0000000000000000000000000000000000000000', tokenAddress, amount, priceFractN, priceFractD],
        senderAddress,
      });
    }
    if (orderType === 'sell') {
      res = await getContract(exchangeAddress, abi).send('createOrder', {
        methodArgs: [tokenAddress, '0000000000000000000000000000000000000000', amount, priceFractN, priceFractD],
        senderAddress,
      });
    }
    return res.txid;
  },
  async cancelOrderExchange(args) {
    const {
      exchangeAddress, // address
      senderAddress,
      orderId,
      abi,
    } = args;
    if (_.isUndefined(exchangeAddress)) {
      throw new TypeError('exchangeAddress needs to be defined');
    }
    if (_.isUndefined(senderAddress)) {
      throw new TypeError('senderAddress needs to be defined');
    }
    if (_.isUndefined(orderId)) {
      throw new TypeError('orderId needs to be defined');
    }
    if (_.isUndefined(abi)) {
      throw new TypeError('abi needs to be defined');
    }

    const res = await getContract(exchangeAddress, abi).send('cancelOrder', {
      methodArgs: [orderId],
      senderAddress,
    });

    return res.txid;
  },

  async executeOrderExchange(args) {
    const {
      exchangeAddress, // address
      senderAddress,
      orderId,
      exchangeAmount,
      abi,
    } = args;
    if (_.isUndefined(exchangeAddress)) {
      throw new TypeError('exchangeAddress needs to be defined');
    }
    if (_.isUndefined(senderAddress)) {
      throw new TypeError('senderAddress needs to be defined');
    }
    if (_.isUndefined(orderId)) {
      throw new TypeError('orderId needs to be defined');
    }
    if (_.isUndefined(exchangeAmount)) {
      throw new TypeError('exchangeAmount needs to be defined');
    }
    if (_.isUndefined(abi)) {
      throw new TypeError('abi needs to be defined');
    }
    const res = await getContract(exchangeAddress, abi).send('executeOrder', {
      methodArgs: [orderId, exchangeAmount],
      senderAddress,
    });
    return res.txid;
  },

};


module.exports = Exchange;
