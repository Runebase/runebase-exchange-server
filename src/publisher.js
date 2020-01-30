const pubsub = require('./pubsub');

const sendSyncInfo = (syncBlockNum, syncBlockTime, syncPercent, peerNodeCount, addressBalances) => {
  pubsub.publish('onSyncInfo', {
    onSyncInfo: {
      syncBlockNum,
      syncBlockTime,
      syncPercent,
      peerNodeCount,
      addressBalances,
    },
  });
};

const sendTradeInfo = (trade) => {
  pubsub.publish('onMyTradeInfo', {
    onMyTradeInfo: {
      tokenAddress: trade.tokenAddress,
      status: trade.status,
      txid: trade.txid,
      from: trade.from,
      to: trade.to,
      soldTokens: trade.soldTokens,
      boughtTokens: trade.boughtTokens,
      token: trade.token,
      tokenName: trade.tokenName,
      orderType: trade.orderType,
      type: trade.type,
      price: trade.price,
      orderId: trade.orderId,
      time: trade.time,
      amount: trade.amount,
      blockNum: trade.blockNum,
      decimals: trade.decimals,
    },
  });
};

const sendFundRedeemInfo = (fundRedeem) => {
  pubsub.publish('onFundRedeemInfo', {
    onFundRedeemInfo: {
      txid: fundRedeem.txid,
      type: fundRedeem.type,
      token: fundRedeem.token,
      tokenName: fundRedeem.tokenName,
      status: fundRedeem.status,
      owner: fundRedeem.owner,
      time: fundRedeem.time,
      amount: fundRedeem.amount,
      blockNum: fundRedeem.blockNum,
    },
  });
};

const sendSellHistoryInfo = (trade) => {
  pubsub.publish('onSellHistoryInfo', {
    onSellHistoryInfo: {
      tokenAddress: trade.tokenAddress,
      status: trade.status,
      txid: trade.txid,
      from: trade.from,
      to: trade.to,
      soldTokens: trade.soldTokens,
      boughtTokens: trade.boughtTokens,
      token: trade.token,
      tokenName: trade.tokenName,
      orderType: trade.orderType,
      type: trade.type,
      price: trade.price,
      orderId: trade.orderId,
      time: trade.time,
      amount: trade.amount,
      blockNum: trade.blockNum,
      decimals: trade.decimals,
    },
  });
};

const sendBuyHistoryInfo = (trade) => {
  pubsub.publish('onBuyHistoryInfo', {
    onBuyHistoryInfo: {
      tokenAddress: trade.tokenAddress,
      status: trade.status,
      txid: trade.txid,
      from: trade.from,
      to: trade.to,
      soldTokens: trade.soldTokens,
      boughtTokens: trade.boughtTokens,
      token: trade.token,
      tokenName: trade.tokenName,
      orderType: trade.orderType,
      type: trade.type,
      price: trade.price,
      orderId: trade.orderId,
      time: trade.time,
      amount: trade.amount,
      blockNum: trade.blockNum,
      decimals: trade.decimals,
    },
  });
};

const sendBuyOrderInfo = (order) => {
  pubsub.publish('onBuyOrderInfo', {
    onBuyOrderInfo: {
      txid: order.txid,
      orderId: order.orderId,
      owner: order.owner,
      token: order.token,
      tokenName: order.tokenName,
      price: order.price,
      type: order.type,
      orderType: order.orderType,
      sellToken: order.sellToken,
      buyToken: order.buyToken,
      priceMul: order.priceMul,
      priceDiv: order.priceDiv,
      time: order.time,
      amount: order.amount,
      startAmount: order.startAmount,
      blockNum: order.blockNum,
      status: order.status,
      decimals: order.decimals,
    },
  });
};

const sendSellOrderInfo = (order) => {
  pubsub.publish('onSellOrderInfo', {
    onSellOrderInfo: {
      txid: order.txid,
      orderId: order.orderId,
      owner: order.owner,
      token: order.token,
      tokenName: order.tokenName,
      price: order.price,
      type: order.type,
      orderType: order.orderType,
      sellToken: order.sellToken,
      buyToken: order.buyToken,
      priceMul: order.priceMul,
      priceDiv: order.priceDiv,
      time: order.time,
      amount: order.amount,
      startAmount: order.startAmount,
      blockNum: order.blockNum,
      status: order.status,
      decimals: order.decimals,
    },
  });
};

const sendActiveOrderInfo = (order) => {
  pubsub.publish('onActiveOrderInfo', {
    onActiveOrderInfo: {
      txid: order.txid,
      orderId: order.orderId,
      owner: order.owner,
      token: order.token,
      tokenName: order.tokenName,
      price: order.price,
      type: order.type,
      orderType: order.orderType,
      sellToken: order.sellToken,
      buyToken: order.buyToken,
      priceMul: order.priceMul,
      priceDiv: order.priceDiv,
      time: order.time,
      amount: order.amount,
      startAmount: order.startAmount,
      blockNum: order.blockNum,
      status: order.status,
      decimals: order.decimals,
    },
  });
};


const sendFulfilledOrderInfo = (order) => {
  pubsub.publish('onFulfilledOrderInfo', {
    onFulfilledOrderInfo: {
      txid: order.txid,
      orderId: order.orderId,
      owner: order.owner,
      token: order.token,
      tokenName: order.tokenName,
      price: order.price,
      type: order.type,
      orderType: order.orderType,
      sellToken: order.sellToken,
      buyToken: order.buyToken,
      priceMul: order.priceMul,
      priceDiv: order.priceDiv,
      time: order.time,
      amount: order.amount,
      startAmount: order.startAmount,
      blockNum: order.blockNum,
      status: order.status,
      decimals: order.decimals,
    },
  });
};

const sendCanceledOrderInfo = (order) => {
  pubsub.publish('onCanceledOrderInfo', {
    onCanceledOrderInfo: {
      txid: order.txid,
      orderId: order.orderId,
      owner: order.owner,
      token: order.token,
      tokenName: order.tokenName,
      price: order.price,
      type: order.type,
      orderType: order.orderType,
      sellToken: order.sellToken,
      buyToken: order.buyToken,
      priceMul: order.priceMul,
      priceDiv: order.priceDiv,
      time: order.time,
      amount: order.amount,
      startAmount: order.startAmount,
      blockNum: order.blockNum,
      status: order.status,
      decimals: order.decimals,
    },
  });
};

const sendChartInfo = (chart) => {
  pubsub.publish('onChartInfo', {
    onChartInfo: {
      tokenAddress: chart.tokenAddress,
      timeTable: chart.timeTable,
      time: chart.time,
      open: chart.open,
      high: chart.high,
      low: chart.low,
      close: chart.close,
      volume: chart.volume,
    },
  });
};

module.exports = {
  sendSyncInfo,
  sendTradeInfo,
  sendFundRedeemInfo,
  sendSellHistoryInfo,
  sendBuyHistoryInfo,
  sendBuyOrderInfo,
  sendSellOrderInfo,
  sendActiveOrderInfo,
  sendFulfilledOrderInfo,
  sendCanceledOrderInfo,
  sendChartInfo,
};
