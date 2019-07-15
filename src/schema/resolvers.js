const _ = require('lodash');
const moment = require('moment');
const math = require('mathjs');
const BigNumber = require('bignumber.js');

const pubsub = require('../pubsub');
const { getLogger } = require('../utils/logger');
const blockchain = require('../api/blockchain');
const network = require('../api/network');
const wallet = require('../api/wallet');
const runebasePredictionToken = require('../api/runebaseprediction_token');
const funToken = require('../api/fun_token');
const { Config, getContractMetadata } = require('../config');
const { db, DBHelper } = require('../db');
const { txState, phase, orderState, SATOSHI_CONVERSION } = require('../constants');
const { calculateSyncPercent, getAddressBalances, getExchangeBalances } = require('../sync');
const Utils = require('../utils');
const exchange = require('../api/exchange');
const { getInstance } = require('../rclient');

const DEFAULT_LIMIT_NUM = 50;
const DEFAULT_SKIP_NUM = 0;

function buildCursorOptions(cursor, orderBy, limit, skip) {
  if (!_.isEmpty(orderBy)) {
    const sortDict = {};
    _.forEach(orderBy, (order) => {
      sortDict[order.field] = order.direction === 'ASC' ? 1 : -1;
    });

    cursor.sort(sortDict);
  }

  cursor.limit(limit || DEFAULT_LIMIT_NUM);
  cursor.skip(skip || DEFAULT_SKIP_NUM);

  return cursor;
}


function buildTransactionFilters({
  OR = [], type, status, topicAddress, oracleAddress, senderAddress, senderQAddress,
}) {
  const filter = (type || status || topicAddress || oracleAddress || senderAddress || senderQAddress) ? {} : null;

  if (type) {
    filter.type = type;
  }

  if (status) {
    filter.status = status;
  }

  if (topicAddress) {
    filter.topicAddress = topicAddress;
  }

  if (oracleAddress) {
    filter.oracleAddress = oracleAddress;
  }

  if (senderAddress) {
    filter.senderAddress = senderAddress;
  }

  if (senderQAddress) {
    filter.senderQAddress = senderQAddress;
  }

  let filters = filter ? [filter] : [];
  for (let i = 0; i < OR.length; i++) {
    filters = filters.concat(buildTransactionFilters(OR[i]));
  }
  return filters;
}

function buildNewOrderFilters({
  OR = [], txid, tokenName, startAmount, orderType, status, token, type, price, orderId, owner, sellToken, buyToken, priceMul, priceDiv, time, amount, blockNum
}) {
  const filter = (txid || tokenName || startAmount || orderType || status || token || type || price || orderId || owner || sellToken || buyToken || priceMul || priceDiv || time || amount || blockNum) ? {} : null;
  if (txid) {
    filter.txid = txid;
  }

  if (tokenName) {
    filter.tokenName = tokenName;
  }

  if (startAmount) {
    filter.startAmount = startAmount;
  }

  if (orderType) {
    filter.orderType = orderType;
  }

  if (status) {
    filter.status = status;
  }

  if (token) {
    filter.token = token;
  }

  if (type) {
    filter.type = type;
  }

  if (price) {
    filter.price = price;
  }

  if (orderId) {
    filter.orderId = orderId;
  }

  if (owner) {
    filter.owner = owner;
  }

  if (sellToken) {
    filter.sellToken = sellToken;
  }

  if (buyToken) {
    filter.buyToken = buyToken;
  }

  if (priceMul) {
    filter.priceMul = priceMul;
  }

  if (priceDiv) {
    filter.priceDiv = priceDiv;
  }

  if (time) {
    filter.time = time;
  }

  if (amount) {
    filter.amount = amount;
  }

  if (blockNum) {
    filter.blockNum = blockNum;
  }
  let filters = filter ? [filter] : [];
  for (let i = 0; i < OR.length; i++) {
    filters = filters.concat(buildNewOrderFilters(OR[i]));
  }
  return filters;
}
function buildMarketFilters({
  OR = [], market, tokenName, price, change, volume
}) {
  const filter = (market || tokenName || price || change || volume) ? {} : null;

  if (market) {
    filter.market = market;
  }

  if (tokenName) {
    filter.tokenName = tokenName;
  }

  if (price) {
    filter.price = price;
  }

  if (change) {
    filter.change = change;
  }

  if (volume) {
    filter.volume = volume;
  }

  let filters = filter ? [filter] : [];
  for (let i = 0; i < OR.length; i++) {
    filters = filters.concat(buildMarketFilters(OR[i]));
  }
  return filters;
}

function buildTradeFilters({
  OR = [], txid, type, status, date, from, to, soldTokens, boughtTokens, tokenName, orderType, price, orderId, time, amount, blockNum
}) {
  const filter = (txid || type || status || date || from || to || soldTokens || boughtTokens || tokenName || orderType || price || orderId  || time || amount || blockNum) ? {} : null;

  if (txid) {
    filter.txid = txid;
  }

  if (type) {
    filter.type = type;
  }

  if (status) {
    filter.status = status;
  }

  if (date) {
    filter.date = date;
  }

  if (from) {
    filter.from = from;
  }

  if (to) {
    filter.to = to;
  }

  if (soldTokens) {
    filter.soldTokens = soldTokens;
  }

  if (boughtTokens) {
    filter.boughtTokens = boughtTokens;
  }

  if (tokenName) {
    filter.tokenName = tokenName;
  }

  if (orderType) {
    filter.orderType = orderType;
  }

  if (price) {
    filter.price = price;
  }

  if (orderId) {
    filter.orderId = orderId;
  }

  if (time) {
    filter.time = time;
  }

  if (amount) {
    filter.amount = amount;
  }

  if (blockNum) {
    filter.blockNum = blockNum;
  }
  let filters = filter ? [filter] : [];
  for (let i = 0; i < OR.length; i++) {
    filters = filters.concat(buildTradeFilters(OR[i]));
  }
  return filters;
}

function buildFundRedeemFilters({
  OR = [], txid, type, token, tokenName, status, owner, time, date, amount, blockNum
}) {
  const filter = (txid || type || token || tokenName || status || owner || time || date || amount || blockNum) ? {} : null;

  if (txid) {
    filter.txid = txid;
  }

  if (type) {
    filter.type = type;
  }

  if (token) {
    filter.token = token;
  }

  if (tokenName) {
    filter.tokenName = tokenName;
  }

  if (status) {
    filter.status = status;
  }

  if (owner) {
    filter.owner = owner;
  }

  if (time) {
    filter.time = time;
  }

  if (date) {
    filter.date = date;
  }

  if (amount) {
    filter.amount = amount;
  }

  if (blockNum) {
    filter.blockNum = blockNum;
  }

  let filters = filter ? [filter] : [];
  for (let i = 0; i < OR.length; i++) {
    filters = filters.concat(buildFundRedeemFilters(OR[i]));
  }
  return filters;
}

module.exports = {
  Query: {
    allNewOrders: async (root, {
      filter, orderBy, limit, skip,
    }, { db: { NewOrder } }) => {
      const query = filter ? { $or: buildNewOrderFilters(filter) } : {};
      let cursor = NewOrder.cfind(query);
      cursor = buildCursorOptions(cursor, orderBy, limit, skip);
      return cursor.exec();
    },

    allFundRedeems: async (root, {
      filter, orderBy, limit, skip,
    }, { db: { FundRedeem } }) => {
      const query = filter ? { $or: buildFundRedeemFilters(filter) } : {};
      let cursor = FundRedeem.cfind(query);
      cursor = buildCursorOptions(cursor, orderBy, limit, skip);
      return cursor.exec();
    },

    allTrades: async (root, {
      filter, orderBy, limit, skip,
    }, { db: { Trade } }) => {
      const query = filter ? { $or: buildTradeFilters(filter) } : {};
      let cursor = Trade.cfind(query);
      cursor = buildCursorOptions(cursor, orderBy, limit, skip);
      return cursor.exec();
    },

    allMarkets: async (root, {
      filter, orderBy, limit, skip,
    }, { db: { Markets } }) => {
      const query = filter ? { $or: buildMarketFilters(filter) } : {};
      let cursor = Markets.cfind(query);
      cursor = buildCursorOptions(cursor, orderBy, limit, skip);
      return cursor.exec();
    },

    allTransactions: async (root, {
      filter, orderBy, limit, skip,
    }, { db: { Transactions } }) => {
      const query = filter ? { $or: buildTransactionFilters(filter) } : {};
      let cursor = Transactions.cfind(query);
      cursor = buildCursorOptions(cursor, orderBy, limit, skip);
      return cursor.exec();
    },

    syncInfo: async (root, { includeBalance }, { db: { Blocks } }) => {
      let blocks;
      try {
        blocks = await Blocks.cfind({}).sort({ blockNum: -1 }).limit(1).exec();
      } catch (err) {
        getLogger().error(`Error query latest block from db: ${err.message}`);
      }

      let syncBlockNum;
      let syncBlockTime;
      if (blocks && blocks.length > 0) {
        // Use latest block synced
        syncBlockNum = blocks[0].blockNum;
        syncBlockTime = blocks[0].blockTime;
      } else {
        // Fetch current block from runebase
        syncBlockNum = Math.max(0, await blockchain.getBlockCount());
        const blockHash = await blockchain.getBlockHash({ blockNum: syncBlockNum });
        syncBlockTime = (await blockchain.getBlock({ blockHash })).time;
      }
      const syncPercent = await calculateSyncPercent(syncBlockNum, syncBlockTime);
      let addressBalances = [];
      if (includeBalance || false) {
        addressBalances = await getAddressBalances();
      }
      const peerNodeCount = await network.getPeerNodeCount();

      return {
        syncBlockNum,
        syncBlockTime,
        syncPercent,
        peerNodeCount,
        addressBalances,
      };
    },
  },

  Mutation: {
    transfer: async (root, data, { db: { Transactions } }) => {
      const {
        senderAddress,
        receiverAddress,
        token,
        amount,
      } = data;

      const version = Config.CONTRACT_VERSION_NUM;

      let txid;
      let sentTx;
      switch (token) {
        case 'RUNES': {
          // Send sendToAddress tx
          try {
            txid = await wallet.sendToAddress({
              address: receiverAddress,
              amount,
              senderAddress,
              changeToAddress: true,
            });
          } catch (err) {
            getLogger().error(`Error calling Wallet.sendToAddress: ${err.message}`);
            throw err;
          }
          break;
        }
        case 'PRED': {
          // Send transfer tx
          try {
            sentTx = await runebasePredictionToken.transfer({
              to: receiverAddress,
              value: amount,
              senderAddress,
            });
            txid = sentTx.txid;
          } catch (err) {
            getLogger().error(`Error calling RunebasePredictionToken.transfer: ${err.message}`);
            throw err;
          }
          break;
        }
        case 'FUN': {
          // Send transfer tx
          try {
            sentTx = await funToken.transfer({
              to: receiverAddress,
              value: amount,
              senderAddress,
            });
            txid = sentTx.txid;
          } catch (err) {
            getLogger().error(`Error calling FunToken.transfer: ${err.message}`);
            throw err;
          }
          break;
        }
        default: {
          throw new Error(`Invalid token transfer type: ${token}`);
        }
      }

      // Insert Transaction
      const gasLimit = sentTx ? sentTx.args.gasLimit : Config.DEFAULT_GAS_LIMIT;
      const gasPrice = sentTx ? sentTx.args.gasPrice : Config.DEFAULT_GAS_PRICE;
      const tx = {
        txid,
        type: 'TRANSFER',
        status: txState.PENDING,
        gasLimit: gasLimit.toString(10),
        gasPrice: gasPrice.toFixed(8),
        createdTime: moment().unix(),
        senderAddress,
        version,
        receiverAddress,
        token,
        amount,
      };
      await DBHelper.insertTransaction(Transactions, tx);

      return tx;
    },
    transferExchange: async (root, data, { db: { Transactions, FundRedeem } }) => {
      const {
        senderAddress,
        receiverAddress,
        token,
        amount,
      } = data;
      let metadata = getContractMetadata();
      const exchangeAddress = await getInstance().fromHexAddress(metadata.Radex.address);
      const version = Config.CONTRACT_VERSION_NUM;
      let txid;
      let sentTx;
      switch (token) {
        case 'RUNES': {
          // Send sendToAddress tx
          try {
            txid = await exchange.fundExchangeRunes({
              exchangeAddress,
              amount,
              senderAddress,
            });
          } catch (err) {
            getLogger().error(`Error calling exchange.fund: ${err.message}`);
            throw err;
          }
          break;
        }
        case 'PRED': {
          // Send transfer tx
          try {
            sentTx = await runebasePredictionToken.transfer({
              to: exchangeAddress,
              value: amount,
              senderAddress,
            });
            txid = sentTx.txid;
          } catch (err) {
            getLogger().error(`Error calling RunebasePredictionToken.transfer: ${err.message}`);
            throw err;
          }
          break;
        }
        case 'FUN': {
          // Send transfer tx
          try {
            sentTx = await funToken.transfer({
              to: exchangeAddress,
              value: amount,
              senderAddress,
            });
            txid = sentTx.txid;
          } catch (err) {
            getLogger().error(`Error calling FunToken.transfer: ${err.message}`);
            throw err;
          }
          break;
        }
        default: {
          throw new Error(`Invalid token transfer type: ${token}`);
        }
      }
      let xAmount
      if (token == 'RUNES') {
        xAmount = amount
      } else {
        xAmount = new BigNumber(amount).dividedBy(SATOSHI_CONVERSION).toString();
      }
      // Insert Transaction
      const gasLimit = sentTx ? sentTx.args.gasLimit : Config.DEFAULT_GAS_LIMIT;
      const gasPrice = sentTx ? sentTx.args.gasPrice : Config.DEFAULT_GAS_PRICE;
      const deposit = {
        txid,
        version,
        senderAddress,
        type: 'DEPOSITEXCHANGE',
        status: orderState.PENDING,
        gasLimit: gasLimit.toString(10),
        gasPrice: gasPrice.toFixed(8),
        time: moment().unix(),
        createdTime: moment().unix(),
        date: new Date(moment().unix()*1000),
        owner: senderAddress,
        receiverAddress,
        token,
        tokenName: token,
        amount: xAmount,
      };

      await DBHelper.insertTopic(db.FundRedeem, deposit);
      return deposit;
    },
    redeemExchange: async (root, data, { db: { Transactions, FundRedeem } }) => {
      const {
        senderAddress,
        receiverAddress,
        token,
        amount,
      } = data;
      let metadata = getContractMetadata();
      const exchangeAddress = await getInstance().fromHexAddress(metadata.Radex.address);
      const version = Config.CONTRACT_VERSION_NUM;
      let txid;
      let sentTx;
      let tokenaddress;

      switch (token) {
        case 'RUNES': {
          // Send sendToAddress tx
          try {
            tokenaddress = "0000000000000000000000000000000000000000";
            txid = await exchange.redeemExchange({
              exchangeAddress,
              amount,
              token,
              tokenaddress,
              senderAddress,
            });
          } catch (err) {
            getLogger().error(`Error calling redeemExchange: ${err.message}`);
            throw err;
          }
          break;
        }
        case 'PRED': {
          // Send transfer tx
          try {
            tokenaddress = metadata.RunebasePredictionToken.address;
            txid = await exchange.redeemExchange({
              exchangeAddress,
              amount,
              token,
              tokenaddress,
              senderAddress,
            });
          } catch (err) {
            getLogger().error(`Error calling redeemExchange: ${err.message}`);
            throw err;
          }
          break;
        }
        case 'FUN': {
          // Send transfer tx
          try {
            tokenaddress = metadata.FunToken.address;
            txid = await exchange.redeemExchange({
              exchangeAddress,
              amount,
              token,
              tokenaddress,
              senderAddress,
            });
          } catch (err) {
            getLogger().error(`Error calling redeemExchange: ${err.message}`);
            throw err;
          }
          break;
        }
        default: {
          throw new Error(`Invalid token transfer type: ${token}`);
        }
      }
      let xAmount
      if (token == 'RUNES') {
        xAmount = amount
      } else {
        xAmount = new BigNumber(amount).dividedBy(SATOSHI_CONVERSION).toString();
      }
      // Insert Transaction
      const gasLimit = sentTx ? sentTx.args.gasLimit : Config.DEFAULT_GAS_LIMIT;
      const gasPrice = sentTx ? sentTx.args.gasPrice : Config.DEFAULT_GAS_PRICE;

      const withdrawal = {
        senderAddress,
        version,
        txid,
        type: 'WITHDRAWEXCHANGE',
        status: txState.PENDING,
        gasLimit: gasLimit.toString(10),
        gasPrice: gasPrice.toFixed(8),
        time: moment().unix(),
        createdTime: moment().unix(),
        date: new Date(moment().unix()*1000),
        owner: senderAddress,
        receiverAddress,
        token,
        tokenName: token,
        amount: xAmount,
      };
      await DBHelper.insertTopic(db.FundRedeem, withdrawal);
      return withdrawal;
    },
    orderExchange: async (root, data, { db: { Transactions } }) => {
      const {
        senderAddress,
        receiverAddress,
        token,
        amount,
        price,
        orderType,
      } = data;
      let metadata = getContractMetadata();
      const exchangeAddress = await getInstance().fromHexAddress(metadata.Radex.address);
      const version = Config.CONTRACT_VERSION_NUM;
      let txid;
      let sentTx;
      let tokenaddress;
      const priceFract = math.fraction(price);
      const priceFractN = priceFract.n;
      const priceFractD = priceFract.d;
      switch (token) {
        case 'PRED': {
          // Send transfer tx
          try {
            tokenaddress = metadata.RunebasePredictionToken.address;
          } catch (err) {
            getLogger().error(`Error calling metadata.RunebasePredictionToken.address: ${err.message}`);
            throw err;
          }
          break;
        }
        case 'FUN': {
          // Send transfer tx
          try {
            tokenaddress = metadata.FunToken.address;
          } catch (err) {
            getLogger().error(`Error calling metadata.FunToken.address: ${err.message}`);
            throw err;
          }
          break;
        }
        default: {
          throw new Error(`Invalid token transfer type: ${token}`);
        }
      }
      try {
        txid = await exchange.orderExchange({
          exchangeAddress,
          amount,
          token,
          tokenaddress,
          senderAddress,
          priceFractN,
          priceFractD,
          orderType,
        });
      } catch (err) {
        getLogger().error(`Error calling orderExchange: ${err.message}`);
        throw err;
      }
      let typeOrder;
      if (orderType == 'buy') {
        typeOrder = 'BUYORDER';
        sellToken = '0000000000000000000000000000000000000000';
        buyToken = tokenaddress;
      }
      if (orderType == 'sell') {
        typeOrder = 'SELLORDER'
        sellToken = tokenaddress;
        buyToken = '0000000000000000000000000000000000000000';
      }
      // Insert Transaction
      const gasLimit = sentTx ? sentTx.args.gasLimit : Config.DEFAULT_GAS_LIMIT;
      const gasPrice = sentTx ? sentTx.args.gasPrice : Config.DEFAULT_GAS_PRICE;
      const tx = {
        txid,
        type: typeOrder,
        orderType: typeOrder,
        tokenName: token,
        status: orderState.PENDING,
        gasLimit: gasLimit.toString(10),
        gasPrice: gasPrice.toFixed(8),
        createdTime: moment().unix(),
        time: moment().unix(),
        senderAddress,
        owner: senderAddress,
        version,
        receiverAddress,
        token,
        price,
        amount,
        startAmount: amount,
        orderId: '?',
        sellToken,
        buyToken,
        priceMul: priceFractN,
        priceDiv: priceFractD,
      };
      await DBHelper.insertTopic(db.NewOrder, tx);
      return tx;
    },
    cancelOrderExchange: async (root, data, { db: { Transactions } }) => {
      const {
        senderAddress,
        orderId,
      } = data;
      let sentTx;
      let metadata = getContractMetadata();
      const exchangeAddress = await getInstance().fromHexAddress(metadata.Radex.address);
      const version = Config.CONTRACT_VERSION_NUM;
      let txid;
      try {
        txid = await exchange.cancelOrderExchange({
          exchangeAddress,
          senderAddress,
          orderId,
        });

      } catch (err) {
        getLogger().error(`Error calling orderExchange: ${err.message}`);
        throw err;
      }

      // Insert Transaction
      const gasLimit = sentTx ? sentTx.args.gasLimit : Config.DEFAULT_GAS_LIMIT;
      const gasPrice = sentTx ? sentTx.args.gasPrice : Config.DEFAULT_GAS_PRICE;

      const NewOrder = {
        txid,
        orderId: orderId,
        type: 'CANCELORDER',
        version,
        status: 'PENDINGCANCEL',
        gasLimit: gasLimit.toString(10),
        gasPrice: gasPrice.toFixed(8),
        createdTime: moment().unix(),
        senderAddress,
        receiverAddress: exchangeAddress,
      };
      await DBHelper.cancelOrderByQuery(db.NewOrder, { orderId }, NewOrder);
      return NewOrder;
    },
    executeOrderExchange: async (root, data, { db: { Transactions } }) => {
      const {
        senderAddress,
        orderId,
        exchangeAmount,
      } = data;
      let sentTx;
      let metadata = getContractMetadata();
      const exchangeAddress = await getInstance().fromHexAddress(metadata.Radex.address);
      const version = Config.CONTRACT_VERSION_NUM;
      let txid;
      try {
        txid = await exchange.executeOrderExchange({
          exchangeAddress,
          senderAddress,
          orderId,
          exchangeAmount,
        });

      } catch (err) {
        getLogger().error(`Error calling executeExchange: ${err.message}`);
        throw err;
      }
      // Insert Transaction
      const gasLimit = sentTx ? sentTx.args.gasLimit : Config.DEFAULT_GAS_LIMIT;
      const gasPrice = sentTx ? sentTx.args.gasPrice : Config.DEFAULT_GAS_PRICE;
      const getOrder = await DBHelper.findOne(db.NewOrder, { orderId });

      let xPrice;
      let xAmount;
      if (getOrder.orderType == 'SELLORDER') {
        xPrice = getOrder.price;
        xAmount = exchangeAmount;
      }
      if (getOrder.orderType == 'BUYORDER') {
        xPrice = (getOrder.price / exchangeAmount) * 1e8;
        xAmount = exchangeAmount * getOrder.price;
      }
      const trade = {
        date: new Date(moment().unix()*1000),
        type: getOrder.orderType,
        txid,
        type: 'EXECUTEORDER',
        status: 'PENDING',
        version,
        exchangeAmount,
        gasLimit: gasLimit.toString(10),
        gasPrice: gasPrice.toFixed(8),
        createdTime: moment().unix(),
        senderAddress,
        receiverAddress: exchangeAddress,
        orderId,
        time: moment().unix(),
        from: senderAddress,
        to: getOrder.owner,
        soldTokens: '',
        boughtTokens: '',
        price: xPrice,
        orderType: getOrder.orderType,
        tokenName: getOrder.tokenName,
        amount: xAmount,
        blockNum: 0,
      }
      await DBHelper.insertTopic(db.Trade, trade)
      return trade;
    },
  },

  Subscription: {
    onSyncInfo: {
      subscribe: () => pubsub.asyncIterator('onSyncInfo'),
    },
  },
};
