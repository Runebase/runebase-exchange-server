const pubsub = require('./pubsub');

module.exports.sendTradeInfo = function (tokenAddress, status, txid, date, from, to, soldTokens, boughtTokens, token, tokenName, orderType, type, price, orderId, time, amount, blockNum) {
  pubsub.publish('onMyTradeInfo', {
    onMyTradeInfo: {
      tokenAddress,
      status,
      txid,
      date,
      from,
      to,
      soldTokens,
      boughtTokens,
      token,
      tokenName,
      orderType,
      type,
      price,
      orderId,
      time,
      amount,
      blockNum,
    },
  });
}

module.exports.sendFundRedeemInfo = function (txid, type, token, tokenName, status, owner, time, date, amount, blockNum) {
  pubsub.publish('onFundRedeemInfo', {
    onFundRedeemInfo: {
      txid,
      type,
      token,
      tokenName,
      status,
      owner,
      time,
      date,
      amount,
      blockNum,
    },
  });
}

module.exports.sendSellHistoryInfo = function (tokenAddress, status, txid, date, from, to, soldTokens, boughtTokens, token, tokenName, orderType, type, price, orderId, time, amount, blockNum) {
  pubsub.publish('onSellHistoryInfo', {
    onSellHistoryInfo: {
      tokenAddress,
      status,
      txid,
      date,
      from,
      to,
      soldTokens,
      boughtTokens,
      token,
      tokenName,
      orderType,
      type,
      price,
      orderId,
      time,
      amount,
      blockNum,
    },
  });
}

module.exports.sendBuyHistoryInfo = function (tokenAddress, status, txid, date, from, to, soldTokens, boughtTokens, token, tokenName, orderType, type, price, orderId, time, amount, blockNum) {
  pubsub.publish('onBuyHistoryInfo', {
    onBuyHistoryInfo: {
      tokenAddress,
      status,
      txid,
      date,
      from,
      to,
      soldTokens,
      boughtTokens,
      token,
      tokenName,
      orderType,
      type,
      price,
      orderId,
      time,
      amount,
      blockNum,
    },
  });
}

module.exports.sendBuyOrderInfo = function (txid, orderId, owner, token, tokenName, price, type, orderType, sellToken, buyToken, priceMul, priceDiv, time, amount, startAmount, blockNum, status) {
  pubsub.publish('onBuyOrderInfo', {
    onBuyOrderInfo: {
      txid,
      orderId,
      owner,
      token,
      tokenName,
      price,
      type,
      orderType,
      sellToken,
      buyToken,
      priceMul,
      priceDiv,
      time,
      amount,
      startAmount,
      blockNum,
      status,
    },
  });
}

module.exports.sendSellOrderInfo = function (txid, orderId, owner, token, tokenName, price, type, orderType, sellToken, buyToken, priceMul, priceDiv, time, amount, startAmount, blockNum, status) {
  pubsub.publish('onSellOrderInfo', {
    onSellOrderInfo: {
      txid,
      orderId,
      owner,
      token,
      tokenName,
      price,
      type,
      orderType,
      sellToken,
      buyToken,
      priceMul,
      priceDiv,
      time,
      amount,
      startAmount,
      blockNum,
      status,
    },
  });
}

module.exports.sendActiveOrderInfo = function (txid, orderId, owner, token, tokenName, price, type, orderType, sellToken, buyToken, priceMul, priceDiv, time, amount, startAmount, blockNum, status) {
  pubsub.publish('onActiveOrderInfo', {
    onActiveOrderInfo: {
      txid,
      orderId,
      owner,
      token,
      tokenName,
      price,
      type,
      orderType,
      sellToken,
      buyToken,
      priceMul,
      priceDiv,
      time,
      amount,
      startAmount,
      blockNum,
      status,
    },
  });
}


module.exports.sendFulfilledOrderInfo = function (txid, orderId, owner, token, tokenName, price, type, orderType, sellToken, buyToken, priceMul, priceDiv, time, amount, startAmount, blockNum, status) {
  pubsub.publish('onFulfilledOrderInfo', {
    onFulfilledOrderInfo: {
      txid,
      orderId,
      owner,
      token,
      tokenName,
      price,
      type,
      orderType,
      sellToken,
      buyToken,
      priceMul,
      priceDiv,
      time,
      amount,
      startAmount,
      blockNum,
      status,
    },
  });
}

module.exports.sendCanceledOrderInfo = function (txid, orderId, owner, token, tokenName, price, type, orderType, sellToken, buyToken, priceMul, priceDiv, time, amount, startAmount, blockNum, status) {
  pubsub.publish('onCanceledOrderInfo', {
    onCanceledOrderInfo: {
      txid,
      orderId,
      owner,
      token,
      tokenName,
      price,
      type,
      orderType,
      sellToken,
      buyToken,
      priceMul,
      priceDiv,
      time,
      amount,
      startAmount,
      blockNum,
      status,
    },
  });
}

module.exports.sendChartInfo = function (tokenAddress, timeTable, time, open, high, low, close, volume) {
  pubsub.publish('onChartInfo', {
    onChartInfo: {
      tokenAddress,
      timeTable,
      time,
      open,
      high,
      low,
      close,
      volume,
    },
  });
}
