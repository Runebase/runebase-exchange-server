const _ = require('lodash');
const moment = require('moment');
const math = require('mathjs');
const BigNumber = require('bignumber.js');
const { withFilter } = require('graphql-subscriptions');

const pubsub = require('../pubsub');
const { sendTradeInfo, sendFundRedeemInfo, sendSellHistoryInfo, sendBuyHistoryInfo } = require('../publisher');
const { getLogger } = require('../utils/logger');
const blockchain = require('../api/blockchain');
const network = require('../api/network');
const wallet = require('../api/wallet');
const Token = require('../api/token');
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
  OR = [], type, status, senderAddress, senderQAddress,
}) {
  const filter = (type || status || senderAddress || senderQAddress) ? {} : null;

  if (type) {
    filter.type = type;
  }

  if (status) {
    filter.status = status;
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
  OR = [], market, tokenName, price, change, volume, address, abi
}) {
  const filter = (market || tokenName || price || change || volume || address || abi) ? {} : null;

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

  if (address) {
    filter.address = address;
  }

  if (abi) {
    filter.abi = abi;
  }

  let filters = filter ? [filter] : [];
  for (let i = 0; i < OR.length; i++) {
    filters = filters.concat(buildMarketFilters(OR[i]));
  }
  return filters;
}

function buildTradeFilters({
  OR = [], txid, type, status, date, from, to, soldTokens, boughtTokens, tokenName, token, orderType, price, orderId, time, amount, blockNum
}) {
  const filter = (txid || type || status || date || from || to || soldTokens || boughtTokens || tokenName || token || orderType || price || orderId  || time || amount || blockNum) ? {} : null;

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

  if (token) {
    filter.token = token;
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

function buildMarketImageFilters({
  OR = [], market, tokenName, image
}) {
  const filter = (market || tokenName || image) ? {} : null;

  if (market) {
    filter.market = market;
  }

  if (tokenName) {
    filter.tokenName = tokenName;
  }

  if (image) {
    filter.image = image;
  }

  let filters = filter ? [filter] : [];
  for (let i = 0; i < OR.length; i++) {
    filters = filters.concat(buildMarketFilters(OR[i]));
  }
  return filters;
}

function buildBaseCurrencyFilters({
  OR = [], pair, name, address
}) {
  const filter = (pair || name || address) ? {} : null;

  if (pair) {
    filter.pair = pair;
  }

  if (name) {
    filter.name = name;
  }

  if (address) {
    filter.address = address;
  }

  let filters = filter ? [filter] : [];
  for (let i = 0; i < OR.length; i++) {
    filters = filters.concat(buildMarketFilters(OR[i]));
  }
  return filters;
}

module.exports = {
  Query: {
    getBaseCurrency: async (root, {
      filter, orderBy, limit, skip,
    }, { db: { BaseCurrency } }) => {
      const query = filter ? { $or: buildBaseCurrencyFilters(filter) } : {};
      let cursor = BaseCurrency.cfind(query);
      cursor = buildCursorOptions(cursor, orderBy, limit, skip);
      return cursor.exec();
    },

    allMarketImages: async (root, {
      filter, orderBy, limit, skip,
    }, { db: { Markets } }) => {
      const query = filter ? { $or: buildMarketImageFilters(filter) } : {};
      let cursor = Markets.cfind(query);
      cursor = buildCursorOptions(cursor, orderBy, limit, skip);
      return cursor.exec();
    },

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
      addressBalances.balance = JSON.stringify(addressBalances.balance);
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
      const markets = await db.Markets.find({});

      const MetaData = await getContractMetadata();
      const version = Config.CONTRACT_VERSION_NUM;
      let txid;
      let sentTx;

      if (token == MetaData['BaseCurrency']['Pair']) {
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
      }
      for(key in markets){
        if (token == markets[key]['market']) {
          try {
            sentTx = await Token.transfer({
              to: receiverAddress,
              value: amount,
              senderAddress,
              token: markets[key]['market'],
              tokenAddress: markets[key]['address'],
              abi: MetaData['TokenAbi'][markets[key]['abi']],
              RrcVersion: markets[key]['abi'],
            });
            txid = sentTx.txid;
          } catch (err) {
            getLogger().error(`Error calling Token.transfer: ${err.message}`);
            throw err;
          }
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

    transferExchange: async (root, data, { db: { FundRedeem } }) => {
      const {
        senderAddress,
        receiverAddress,
        token,
        amount,
      } = data;
      const markets = await db.Markets.find({});
      const MetaData = await getContractMetadata();
      const exchangeAddress = await getInstance().fromHexAddress(MetaData['Exchange']['Address']);
      const version = Config.CONTRACT_VERSION_NUM;
      let txid;
      let sentTx;

      if (token == MetaData['BaseCurrency']['Pair']) {
        try {
          txid = await exchange.depositExchangeBaseCurrency({
            exchangeAddress: MetaData['Exchange']['Address'],
            amount,
            senderAddress,
            abi: MetaData['Exchange']['Abi'],
          });
        } catch (err) {
          getLogger().error(`Error calling exchange.fund: ${err.message}`);
          throw err;
        }
      }
      for(key in markets){
        if (token == markets[key]['market']) {
          try {
            sentTx = await Token.transfer({
              to: exchangeAddress,
              value: amount,
              senderAddress,
              token: markets[key]['market'],
              tokenAddress: markets[key]['address'],
              abi: MetaData['TokenAbi'][markets[key]['abi']],
              RrcVersion: markets[key]['abi'],
            });
            txid = sentTx.txid;
          } catch (err) {
            getLogger().error(`Error calling Token.transfer: ${err.message}`);
            throw err;
          }
        }
      }

      getLogger().debug('Token Deposit' + token);
      getLogger().debug('New Big Number Deposit: ' + new BigNumber(amount).dividedBy(SATOSHI_CONVERSION).toString());
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
        amount: new BigNumber(amount).dividedBy(SATOSHI_CONVERSION).toString(),
      };
      sendFundRedeemInfo(
        deposit.txid,
        deposit.type,
        deposit.token,
        deposit.tokenName,
        deposit.status,
        deposit.owner,
        deposit.time,
        deposit.date,
        deposit.amount,
        deposit.blockNum
      );
      await DBHelper.insertTopic(db.FundRedeem, deposit);
      return deposit;
    },

    redeemExchange: async (root, data, { db: { FundRedeem } }) => {
      const {
        senderAddress,
        receiverAddress,
        token,
        amount,
      } = data;
      const markets = await db.Markets.find({});
      let MetaData = await getContractMetadata();
      const exchangeAddress = await getInstance().fromHexAddress(MetaData['Exchange']['Address']);
      const version = Config.CONTRACT_VERSION_NUM;
      let txid;
      let sentTx;
      let tokenaddress;

      if (token == MetaData['BaseCurrency']['Pair']) {
        try {
          //tokenaddress = "0000000000000000000000000000000000000000";
          txid = await exchange.redeemExchange({
            exchangeAddress: MetaData['Exchange']['Address'],
            amount,
            token,
            tokenaddress: MetaData['BaseCurrency']['Address'],
            senderAddress,
            abi: MetaData['Exchange']['Abi'],
          });
        } catch (err) {
          getLogger().error(`Error calling redeemExchange: ${err.message}`);
          throw err;
        }
      }
      for(redeemExchangeToken in markets){
        if (token == markets[redeemExchangeToken]['market']) {
          try {
            //tokenaddress = metaData.Tokens.PredictionToken.address;
            txid = await exchange.redeemExchange({
              exchangeAddress: MetaData['Exchange']['Address'],
              amount,
              token,
              tokenaddress: markets[redeemExchangeToken]['address'],
              senderAddress,
              abi: MetaData['Exchange']['Abi'],
            });
          } catch (err) {
            getLogger().error(`Error calling redeemExchange: ${err.message}`);
            throw err;
          }
        }
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
        amount: new BigNumber(amount).dividedBy(SATOSHI_CONVERSION).toString(),
      };
      getLogger().debug(JSON.stringify(withdrawal));
      sendFundRedeemInfo(
        withdrawal.txid,
        withdrawal.type,
        withdrawal.token,
        withdrawal.tokenName,
        withdrawal.status,
        withdrawal.owner,
        withdrawal.time,
        withdrawal.date,
        withdrawal.amount,
        withdrawal.blockNum
      );
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
      const markets = await db.Markets.find({});
      const MetaData = await getContractMetadata();
      const exchangeAddress = await getInstance().fromHexAddress(MetaData['Exchange']['Address']);
      const version = Config.CONTRACT_VERSION_NUM;
      let txid;
      let sentTx;
      let tokenaddress;
      const priceFract = math.fraction(price);
      const priceFractN = priceFract.n;
      const priceFractD = priceFract.d;

      for (TokenName in markets) {
        if (token == markets[TokenName]['market']) {
          try {
            tokenaddress = markets[TokenName]['address'];
          } catch (err) {
            getLogger().error(`Error calling MetaData['Tokens'][${TokenName}]['Address']: ${err.message}`);
            throw err;
          }
        }
      }

      try {
        txid = await exchange.orderExchange({
          exchangeAddress: MetaData['Exchange']['Address'],
          amount,
          token,
          tokenaddress,
          senderAddress,
          priceFractN,
          priceFractD,
          orderType,
          abi: MetaData['Exchange']['Abi'],
        });
      } catch (err) {
        getLogger().error(`Error calling orderExchange: ${err.message}`);
        throw err;
      }
      console.log(txid);
      let typeOrder;
      if (orderType == 'buy') {
        typeOrder = 'BUYORDER';
        sellToken = MetaData['BaseCurrency']['Address'];
        buyToken = tokenaddress;
      }
      if (orderType == 'sell') {
        typeOrder = 'SELLORDER'
        sellToken = tokenaddress;
        buyToken = MetaData['BaseCurrency']['Address'];
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
      const MetaData = await getContractMetadata();
      const exchangeAddress = await getInstance().fromHexAddress(MetaData['Exchange']['Address']);
      const version = Config.CONTRACT_VERSION_NUM;
      let txid;

      try {
        txid = await exchange.cancelOrderExchange({
          exchangeAddress: MetaData['Exchange']['Address'],
          senderAddress,
          orderId,
          abi: MetaData['Exchange']['Abi'],
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
      const MetaData = await getContractMetadata();
      const exchangeAddress = await getInstance().fromHexAddress(MetaData['Exchange']['Address']);
      const version = Config.CONTRACT_VERSION_NUM;
      let txid;

      try {
        txid = await exchange.executeOrderExchange({
          exchangeAddress: MetaData['Exchange']['Address'],
          senderAddress,
          orderId,
          exchangeAmount,
          abi: MetaData['Exchange']['Abi'],
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
        token: getOrder.token,
        amount: xAmount,
        blockNum: 0,
      }
      sendTradeInfo(trade.status, trade.txid, trade.date, trade.from, trade.to, trade.soldTokens, trade.boughtTokens, trade.token, trade.tokenName, trade.orderType, trade.type, trade.price, trade.orderId, trade.time, trade.amount, trade.blockNum);
      sendSellHistoryInfo(trade.status, trade.txid, trade.date, trade.from, trade.to, trade.soldTokens, trade.boughtTokens, trade.token, trade.tokenName, trade.orderType, trade.type, trade.price, trade.orderId, trade.time, trade.amount, trade.blockNum);
      sendBuyHistoryInfo(trade.status, trade.txid, trade.date, trade.from, trade.to, trade.soldTokens, trade.boughtTokens, trade.token, trade.tokenName, trade.orderType, trade.type, trade.price, trade.orderId, trade.time, trade.amount, trade.blockNum);
      await DBHelper.insertTopic(db.Trade, trade)
      return trade;
    },
  },

  Subscription: {
    onSyncInfo: {
      subscribe: () => pubsub.asyncIterator('onSyncInfo'),
    },
    onMyTradeInfo: {
      subscribe: withFilter(() => pubsub.asyncIterator('onMyTradeInfo'), (payload, variables) => {
        if (payload.onMyTradeInfo.from === variables.from) {
          return true;
        }
        if (payload.onMyTradeInfo.to === variables.to) {
          return true;
        }
      }),
    },
    onFundRedeemInfo: {
      subscribe: withFilter(() => pubsub.asyncIterator('onFundRedeemInfo'), (payload, variables) => {
        console.log('onFundRedeemInfo with filter');
        if (payload.onFundRedeemInfo.owner === variables.owner) {
          return true;
        }
      }),
    },
    onSellHistoryInfo: {
      subscribe: withFilter(() => pubsub.asyncIterator('onSellHistoryInfo'), (payload, variables) => {
        console.log('onSellHistoryInfo with filter');
        if (payload.onSellHistoryInfo.token === variables.token && payload.onSellHistoryInfo.orderType === variables.orderType) {
          return true;
        }
      }),
    },
    onBuyHistoryInfo: {
      subscribe: withFilter(() => pubsub.asyncIterator('onBuyHistoryInfo'), (payload, variables) => {
        console.log('onBuyHistoryInfo with filter');
        if (payload.onBuyHistoryInfo.token === variables.token && payload.onBuyHistoryInfo.orderType === variables.orderType) {
          return true;
        }
      }),
    },

    onSelectedOrderInfo: {
      subscribe: () => pubsub.asyncIterator('onSelectedOrderInfo'),
    },
    onActiveOrderInfo: {
      subscribe: () => pubsub.asyncIterator('onActiveOrderInfo'),
    },
    onFulfilledOrderInfo: {
      subscribe: () => pubsub.asyncIterator('onFulfilledOrderInfo'),
    },
    onCanceledOrderInfo: {
      subscribe: () => pubsub.asyncIterator('onCanceledOrderInfo'),
    },
    onBuyOrderInfo: {
      subscribe: () => pubsub.asyncIterator('onBuyOrderInfo'),
    },
    onSellOrderInfo: {
      subscribe: () => pubsub.asyncIterator('onSellOrderInfo'),
    },
  },
};
