const pubsub = require('./pubsub');

module.exports.sendTradeInfo = (tokenAddress, status, txid, from, to, soldTokens, boughtTokens, token, tokenName, orderType, type, price, orderId, time, amount, blockNum, decimals) => {
  pubsub.publish('onMyTradeInfo', {
    onMyTradeInfo: {
      tokenAddress,
      status,
      txid,
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
      decimals,
    },
  });
};

module.exports.sendFundRedeemInfo = (txid, type, token, tokenName, status, owner, time, amount, blockNum) => {
  pubsub.publish('onFundRedeemInfo', {
    onFundRedeemInfo: {
      txid,
      type,
      token,
      tokenName,
      status,
      owner,
      time,
      amount,
      blockNum,
    },
  });
};

module.exports.sendSellHistoryInfo = (tokenAddress, status, txid, from, to, soldTokens, boughtTokens, token, tokenName, orderType, type, price, orderId, time, amount, blockNum, decimals) => {
  pubsub.publish('onSellHistoryInfo', {
    onSellHistoryInfo: {
      tokenAddress,
      status,
      txid,
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
      decimals,
    },
  });
};

module.exports.sendBuyHistoryInfo = (tokenAddress, status, txid, from, to, soldTokens, boughtTokens, token, tokenName, orderType, type, price, orderId, time, amount, blockNum, decimals) => {
  pubsub.publish('onBuyHistoryInfo', {
    onBuyHistoryInfo: {
      tokenAddress,
      status,
      txid,
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
      decimals,
    },
  });
};

module.exports.sendBuyOrderInfo = (txid, orderId, owner, token, tokenName, price, type, orderType, sellToken, buyToken, priceMul, priceDiv, time, amount, startAmount, blockNum, status, decimals) => {
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
      decimals,
    },
  });
};

module.exports.sendSellOrderInfo = (txid, orderId, owner, token, tokenName, price, type, orderType, sellToken, buyToken, priceMul, priceDiv, time, amount, startAmount, blockNum, status, decimals) => {
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
      decimals,
    },
  });
};

module.exports.sendActiveOrderInfo = (txid, orderId, owner, token, tokenName, price, type, orderType, sellToken, buyToken, priceMul, priceDiv, time, amount, startAmount, blockNum, status, decimals) => {
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
      decimals,
    },
  });
};


module.exports.sendFulfilledOrderInfo = (txid, orderId, owner, token, tokenName, price, type, orderType, sellToken, buyToken, priceMul, priceDiv, time, amount, startAmount, blockNum, status, decimals) => {
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
      decimals,
    },
  });
};

module.exports.sendCanceledOrderInfo = (txid, orderId, owner, token, tokenName, price, type, orderType, sellToken, buyToken, priceMul, priceDiv, time, amount, startAmount, blockNum, status, decimals) => {
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
      decimals,
    },
  });
};

module.exports.sendChartInfo = (tokenAddress, timeTable, time, open, high, low, close, volume) => {
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
};
