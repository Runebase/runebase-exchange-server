const pubsub = require('./pubsub');

module.exports.sendTradeInfo = function (status, txid, date, from, to, soldTokens, boughtTokens, token, tokenName, orderType, type, price, orderId, time, amount, blockNum) {
  pubsub.publish('onMyTradeInfo', {
    onMyTradeInfo: {
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