/* eslint no-underscore-dangle: [2, { "allow": ["_eventName", "_address", "_time", "_orderId"] }] */
const _ = require('lodash');
const moment = require('moment');
const BigNumber = require('bignumber.js');
const { forEach } = require('p-iteration');
const abi = require('ethjs-abi');
const {
  sendSyncInfo,
  sendTradeInfo,
  sendFundRedeemInfo,
  sendSellHistoryInfo,
  sendBuyHistoryInfo,
  sendSellOrderInfo,
  sendBuyOrderInfo,
  sendActiveOrderInfo,
  sendCanceledOrderInfo,
  sendFulfilledOrderInfo,
  sendChartInfo,
} = require('../publisher');
const { getLogger } = require('../utils/logger');
// const { Utils } = require('rweb3');
const { getContractMetadata, isMainnet } = require('../config');
const { BLOCK_0_TIMESTAMP, SATOSHI_CONVERSION, fill } = require('../constants');
const { db, DBHelper } = require('../db');
const updateStatusDB = require('./updateLocalTx');
const Utils = require('../utils');
const NewOrder = require('../models/newOrder');
const CancelOrder = require('../models/cancelOrder');
const FulfillOrder = require('../models/fulfillOrder');
const Trade = require('../models/trade');
const MarketMaker = require('../models/marketMaker');
const FundRedeem = require('../models/fundRedeem');
// const OrderFulfilled = require('../models/orderFulfilled');
const Market = require('../models/market');
const Token = require('../api/token');
const wallet = require('../api/wallet');
const network = require('../api/network');
const exchange = require('../api/exchange');
const { getInstance } = require('../rclient');
const { orderState } = require('../constants');
// const { txState } = require('../constants');


// Example to hash event functions
// const Web3 = require('web3');
// const web3 = new Web3();
// console.log(Web3.utils.sha3('ListingCreated(address,string,string,string,uint8,uint8,uint256)'))

const RPC_BATCH_SIZE = 5;
const BLOCK_BATCH_SIZE = 200;
const SYNC_THRESHOLD_SECS = 1200;

// hardcode sender address as it doesnt matter
let MetaData;
let senderAddress;

const timeTable = ['1h', '3h', '6h', '12h', 'd', 'w'];
const timeFrame = [];
timeFrame['1h'] = 3600;
timeFrame['3h'] = 10800;
timeFrame['6h'] = 21600;
timeFrame['12h'] = 43200;
timeFrame.d = 86400;
timeFrame.w = 604800;

const insertEmptyCandles = async (timeNow, t, address) => {
  const ohlc = await db.Charts.cfind({ tokenAddress: address, timeTable: t }).sort({ time: -1 }).limit(1).exec();
  if (timeNow - timeFrame[t] > ohlc[0].time) {
    const changeOHLC = {
      tokenAddress: address,
      timeTable: t,
      time: ohlc[0].time + timeFrame[t],
      open: ohlc[0].close,
      high: ohlc[0].close,
      low: ohlc[0].close,
      close: ohlc[0].close,
      volume: 0,
    };
    await db.Charts.insert(changeOHLC);
    sendChartInfo(changeOHLC);
    await insertEmptyCandles(timeNow, t, address);
  }
};

const updateEmptyCandles = async () => {
  const markets = await db.Markets.find({});
  const timeNow = parseInt(moment().unix(), 10);

  /* p-iteration example */
  // await forEach(markets, async (market) => {
  //  await forEach(timeTable, async (t) => {
  //    await insertEmptyCandles(timeNow, t, market.address);
  //  });
  // });

  Object.keys(markets).forEach((market) => {
    Object.keys(timeFrame).forEach((t) => {
      insertEmptyCandles(timeNow, t, markets[market].address);
    });
  });
};

const sequentialLoop = (iterations, process, exit) => {
  let index = 0;
  let done = false;
  let shouldExit = false;

  const loop = {
    next() {
      if (done) {
        if (shouldExit && exit) {
          return exit();
        }
      }

      if (index < iterations) {
        index++;
        process(loop);
      } else {
        done = true;

        if (exit) {
          exit();
        }
      }
    },

    iteration() {
      return index - 1; // Return the loop number we're on
    },

    break(end) {
      done = true;
      shouldExit = end;
    },
  };
  loop.next();
  return loop;
};

const syncTokenListingCreated = async (startBlock, endBlock, removeHexPrefix) => {
  let result;
  const ListingCreatedPromises = [];
  try {
    result = await getInstance().searchLogs(
      startBlock, endBlock, MetaData.Registery.Address,
      [MetaData.Registery.ListingCreated], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog ListingCreated');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }
  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${result.length} entries from ListingCreated`);

  _.forEach(result, (event, index) => {
    // const blockNum = event.blockNumber;
    // const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {
      const topics = rawLog.topics.map((i) => `0x${i}`);
      const data = `0x${rawLog.data}`;
      const OutputBytecode = abi.decodeEvent(MetaData.Registery.Abi[7], data, topics);

      if (OutputBytecode._eventName === 'ListingCreated') {
        const insertListingCreated = new Promise(async (resolve) => {
          try {
            const market = new Market(OutputBytecode).translate();
            const marketAddress = market.address;

            if (await DBHelper.getCount(db.Markets, { address: marketAddress }) > 0) {
              // const getMarket = await DBHelper.findOne(db.Markets, { address: marketAddress });
              await DBHelper.updateMarketByQuery(db.Markets, { address: marketAddress }, market);
            } else {
              await forEach(timeTable, async (t) => {
                const initChart = {
                  tokenAddress: marketAddress,
                  timeTable: t,
                  time: market.startTime,
                  open: 0,
                  high: 0,
                  low: 0,
                  close: 0,
                  volume: 0,
                };
                await db.Charts.insert(initChart);
              });
              // for (const t of timeTable) {
              //  const initChart = {
              //    tokenAddress: marketAddress,
              //    timeTable: t,
              //    time: market.startTime,
              //    open: 0,
              //    high: 0,
              //    low: 0,
              //    close: 0,
              //    volume: 0,
              //  };
              //  await db.Charts.insert(initChart);
              // }
              await db.Markets.insert(market);
            }
            await DBHelper.changeMarketByQuery(db.NewOrder, { sellToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.NewOrder, { buyToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.OrderFulfilled, { sellToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.OrderFulfilled, { buyToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.Trade, { tokenAddress: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.Trade, { tokenAddress: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.FundRedeem, { tokenAddress: marketAddress }, market);
            resolve();
          } catch (err) {
            getLogger().error(`ERROR: ${err.message}`);
          }
        });
        ListingCreatedPromises.push(insertListingCreated);
      }
    });
  });
  await Promise.all(ListingCreatedPromises);
};

const syncTokenListingUpdated = async (startBlock, endBlock, removeHexPrefix) => {
  let result;
  const ListingUpdatedPromises = [];
  try {
    result = await getInstance().searchLogs(
      startBlock, endBlock, MetaData.Registery.Address,
      [MetaData.Registery.ListingUpdated], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog ListingUpdated');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }
  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${result.length} entries from ListingUpdated`);

  _.forEach(result, (event, index) => {
    // const blockNum = event.blockNumber;
    // const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {
      const topics = rawLog.topics.map((i) => `0x${i}`);
      const data = `0x${rawLog.data}`;
      const OutputBytecode = abi.decodeEvent(MetaData.Registery.Abi[8], data, topics);

      if (OutputBytecode._eventName === 'ListingUpdated') {
        const insertListingUpdated = new Promise(async (resolve) => {
          try {
            const market = new Market(OutputBytecode).translate();
            const marketAddress = market.address;

            await DBHelper.changeMarketByQuery(db.Charts, { tokenAddress: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.NewOrder, { sellToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.NewOrder, { buyToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.OrderFulfilled, { sellToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.OrderFulfilled, { buyToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.Trade, { tokenAddress: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.Trade, { tokenAddress: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.FundRedeem, { tokenAddress: marketAddress }, market);
            resolve();
          } catch (err) {
            getLogger().error(`ERROR: ${err.message}`);
          }
        });
        ListingUpdatedPromises.push(insertListingUpdated);
      }
    });
  });
  await Promise.all(ListingUpdatedPromises);
};

const syncTokenListingDeleted = async (startBlock, endBlock, removeHexPrefix) => {
  let result;
  const ListingUpdatedPromises = [];
  try {
    result = await getInstance().searchLogs(
      startBlock, endBlock, MetaData.Registery.Address,
      [MetaData.Registery.ListingDeleted], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog ListingDeleted');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }
  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${result.length} entries from ListingDeleted`);

  _.forEach(result, (event, index) => {
    // const blockNum = event.blockNumber;
    // const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {
      const topics = rawLog.topics.map((i) => `0x${i}`);
      const data = `0x${rawLog.data}`;
      const OutputBytecode = abi.decodeEvent(MetaData.Registery.Abi[9], data, topics);

      if (OutputBytecode._eventName === 'ListingDeleted') {
        const insertListingUpdated = new Promise(async (resolve) => {
          try {
            const market = {
              token: 'Unregistered',
              tokenName: 'Unregistered Token',
            };
            const marketAddress = OutputBytecode._address;

            await DBHelper.removeOrdersByQuery(db.Markets, { address: marketAddress });
            await DBHelper.changeMarketByQuery(db.NewOrder, { sellToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.NewOrder, { buyToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.OrderFulfilled, { sellToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.OrderFulfilled, { buyToken: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.Trade, { tokenAddress: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.Trade, { tokenAddress: marketAddress }, market);
            await DBHelper.changeMarketByQuery(db.FundRedeem, { tokenAddress: marketAddress }, market);
            resolve();
          } catch (err) {
            getLogger().error(`ERROR: ${err.message}`);
          }
        });
        ListingUpdatedPromises.push(insertListingUpdated);
      }
    });
  });
  await Promise.all(ListingUpdatedPromises);
};

// Gets all promises for new blocks to insert
const getInsertBlockPromises = async (startBlock, endBlock) => {
  let blockHash;
  let blockTime;
  const insertBlockPromises = [];

  for (let i = startBlock; i <= endBlock; i++) {
    try {
      blockHash = await getInstance().getBlockHash(i);
      blockTime = (await getInstance().getBlock(blockHash)).time;
    } catch (err) {
      getLogger().error(err);
    }

    insertBlockPromises.push(new Promise(async (resolve) => {
      try {
        await db.Blocks.insert({
          _id: i,
          blockNum: i,
          blockTime,
        });
      } catch (err) {
        getLogger().error(err);
      }
      resolve();
    }));
  }

  return { insertBlockPromises, endBlockTime: blockTime };
};

const peerHighestSyncedHeader = async () => {
  let peerBlockHeader = null;
  try {
    const res = await getInstance().getPeerInfo();
    _.each(res, (nodeInfo) => {
      if (_.isNumber(nodeInfo.synced_headers) && nodeInfo.synced_headers !== -1) {
        peerBlockHeader = Math.max(nodeInfo.synced_headers, peerBlockHeader);
      }
    });
  } catch (err) {
    getLogger().error(`Error calling getPeerInfo: ${err.message}`);
    return null;
  }

  return peerBlockHeader;
};

const calculateSyncPercent = async (blockCount, blockTime) => {
  const peerBlockHeader = await peerHighestSyncedHeader();
  if (_.isNull(peerBlockHeader)) {
    // estimate by blockTime
    let syncPercent = 100;
    const timestampNow = moment().unix();
    // if blockTime is 20 min behind, we are not fully synced
    if (blockTime < timestampNow - SYNC_THRESHOLD_SECS) {
      syncPercent = Math.floor(((blockTime - BLOCK_0_TIMESTAMP) / (timestampNow - BLOCK_0_TIMESTAMP)) * 100);
    }
    return syncPercent;
  }

  return Math.floor((blockCount / peerBlockHeader) * 100);
};

const getAddressBalances = async () => {
  const addressObjs = [];
  const addressList = [];
  try {
    const res = await getInstance().listAddressGroupings();
    // grouping: [["qNh8krU54KBemhzX4zWG9h3WGpuCNYmeBd", 0.01], ["qNh8krU54KBemhzX4zWG9h3WGpuCNYmeBd", 0.02]], [...]
    _.each(res, (grouping) => {
      // addressArrItem: ["qNh8krU54KBemhzX4zWG9h3WGpuCNYmeBd", 0.08164600]
      _.each(grouping, (addressArrItem) => {
        addressObjs.push({
          address: addressArrItem[0],
          Wallet: {
            RUNES: new BigNumber(addressArrItem[1]).toString(10),
          },
          Exchange: {},
        });
        addressList.push(addressArrItem[0]);
      });
    });
  } catch (err) {
    getLogger().error(`listAddressGroupings: ${err.message}`);
  }
  // //////////////////////////////////////////////////////////
  const addressBatches = _.chunk(addressList, RPC_BATCH_SIZE);
  await new Promise(async (resolve) => {
    sequentialLoop(addressBatches.length, async (loop) => {
      const walletBalancePromises = [];
      const exchangeBasePromises = [];
      const exchangeBalancePromises = [];
      const StringPromises = [];
      const markets = await db.Markets.find({});

      _.map(addressBatches[loop.iteration()], async (address) => {
        const exchangeBasePromise = new Promise(async (ExchangeBaseResolve) => {
          try {
            let Balance = new BigNumber(0);
            const hex = await getInstance().getHexAddress(address);
            const resp = await exchange.balanceOf({
              token: MetaData.BaseCurrency.Address,
              user: hex,
              senderAddress: address,
              exchangeAddress: MetaData.Exchange.Address,
              abi: MetaData.Exchange.Abi,
            });
            Balance = await Utils.hexToDecimalString(resp.executionResult.formattedOutput[0]);
            const found = _.find(addressObjs, { address });
            found.Exchange[MetaData.BaseCurrency.Pair] = new BigNumber(Balance).dividedBy(SATOSHI_CONVERSION).toString(10);
            ExchangeBaseResolve();
          } catch (err) {
            getLogger().error(`BalanceOf ${address}: ${err.message}`);
          }
        });

        const exchangeBalancePromise = markets.reduce(async (prev, ExchangeToken) => {
          await prev;
          try {
            let Balance = new BigNumber(0);
            const hex = await getInstance().getHexAddress(address);
            const resp = await exchange.balanceOf({
              token: ExchangeToken.address,
              user: hex,
              senderAddress: address,
              exchangeAddress: MetaData.Exchange.Address,
              abi: MetaData.Exchange.Abi,
            });
            Balance = Utils.hexToDecimalString(resp.executionResult.formattedOutput[0]);
            const found = _.find(addressObjs, { address });
            found.Exchange[ExchangeToken.market] = new BigNumber(Balance).dividedBy(10 ** ExchangeToken.decimals).toString(10);
          } catch (err) {
            getLogger().error(`BalanceOf ${address}: ${err.message}`);
          }
        }, Promise.resolve());

        const walletBalancePromise = markets.reduce(async (prev, WalletToken) => {
          await prev;
          try {
            const myAbi = MetaData.TokenAbi[WalletToken.abi];
            let Balance = new BigNumber(0);
            const resp = await Token.balanceOf({
              owner: address,
              senderAddress: address,
              token: WalletToken.market,
              tokenAddress: WalletToken.address,
              abi: myAbi,
            });
            Balance = resp.balance;
            const found = _.find(addressObjs, { address });
            found.Wallet[WalletToken.market] = new BigNumber(Balance).dividedBy(10 ** WalletToken.decimals).toString(10);
          } catch (err) {
            getLogger().error(`BalanceOf ${address}: ${err.message}`);
          }
        }, Promise.resolve());

        exchangeBasePromises.push(exchangeBasePromise);
        exchangeBalancePromises.push(exchangeBalancePromise);
        walletBalancePromises.push(walletBalancePromise);
      });
      await Promise.all(exchangeBasePromises);
      await Promise.all(exchangeBalancePromises);
      await Promise.all(walletBalancePromises);


      // Create String of the balances so we can send the data over GraphQL
      // without knowing the Graphql schema for RRC223 tokens in advance.
      _.map(addressBatches[loop.iteration()], async (address) => {
        const StringPromise = new Promise(async (StringResolve) => {
          try {
            const found = await _.find(addressObjs, { address });
            found.balance = JSON.stringify(found);
            StringResolve();
          } catch (err) {
            getLogger().error(`BalanceOf ${address}: ${err.message}`);
          }
        });

        StringPromises.push(StringPromise);
      });
      await Promise.all(StringPromises);
      loop.next();
    }, () => {
      resolve();
    });
  });

  // Add default address with zero balances if no address was used before ¯\_(ツ)_/¯
  if (_.isEmpty(addressObjs)) {
    let address;
    const emptyObject = {};
    try {
      try {
        address = await wallet.getAddressesByLabel('default');
      } catch (err) {
        if (err.response.status === 500) {
          try {
            console.log(`${err.response.status}: No Wallet found, Creating new...`);
            address = await wallet.getNewAddress('default');
          } catch (error) {
            console.log(error);
          }
        }
      }

      address = Object.keys(address)[0];

      emptyObject.address = Object.keys(address)[0];
      emptyObject.Wallet = {};
      emptyObject.Exchange = {};
      emptyObject.address = address;
      Object.keys(MetaData.Tokens).forEach((EmptyTokenNames) => {
        console.log(EmptyTokenNames);
        emptyObject.Exchange[MetaData.Tokens[EmptyTokenNames].Pair] = '0';
        emptyObject.Wallet[MetaData.Tokens[EmptyTokenNames].Pair] = '0';
      });
      // for (const EmptyTokenNames in MetaData.Tokens) {
      //   console.log(EmptyTokenNames);
      //   emptyObject.Exchange[MetaData.Tokens[EmptyTokenNames].Pair] = '0';
      //   emptyObject.Wallet[MetaData.Tokens[EmptyTokenNames].Pair] = '0';
      // }
      emptyObject.Exchange[MetaData.BaseCurrency.Pair] = '0';
      emptyObject.Wallet[MetaData.BaseCurrency.Pair] = '0';
      emptyObject.balance = JSON.stringify(emptyObject);
      addressObjs.push(
        emptyObject,
      );
    } catch (err) {
      console.log(err);
    }
  }

  const addressObjstring = JSON.stringify(addressObjs);
  addressObjs.balance = addressObjstring;

  return addressObjs;
};


const syncNewOrder = async (startBlock, endBlock, removeHexPrefix) => {
  let result;
  const createNewOrderPromises = [];
  const markets = await db.Markets.find({});
  try {
    result = await getInstance().searchLogs(
      startBlock, endBlock, MetaData.Exchange.Address,
      [MetaData.Exchange.NewOrder], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog New Order');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }
  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${result.length} entries from New Order`);

  _.forEach(result, (event, index) => {
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {
      const topics = rawLog.topics.map((i) => `0x${i}`);
      const data = `0x${rawLog.data}`;
      const OutputBytecode = abi.decodeEvent(MetaData.Exchange.Abi[16], data, topics);

      if (OutputBytecode._eventName === 'NewOrder' && parseInt(OutputBytecode._time.toString(10), 10) !== 0) {
        const insertNewOrderDB = new Promise(async (resolve) => {
          try {
            const newOrder = new NewOrder(
              blockNum,
              txid,
              OutputBytecode,
              markets,
              MetaData.BaseCurrency.Address,
            ).translate();
            if (await DBHelper.getCount(db.NewOrder, { txid }) > 0) {
              DBHelper.updateOrderByQuery(db.NewOrder, { txid }, newOrder);
            } else {
              DBHelper.insertTopic(db.NewOrder, newOrder);
            }
            sendSellOrderInfo(newOrder);
            sendBuyOrderInfo(newOrder);
            sendActiveOrderInfo(newOrder);

            resolve();
          } catch (err) {
            getLogger().error(`ERROR: ${err.message}`);
            // resolve();
          }
        });
        createNewOrderPromises.push(insertNewOrderDB);
      }
    });
  });
  await Promise.all(createNewOrderPromises);
};

const syncOrderCancelled = async (startBlock, endBlock, removeHexPrefix) => {
  let result;
  try {
    result = await getInstance().searchLogs(
      startBlock, endBlock, MetaData.Exchange.Address,
      [MetaData.Exchange.OrderCancelled], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog OrderCancelled');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }

  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${result.length} entries from OrderCancelled`);
  const createCancelOrderPromises = [];

  _.forEach(result, (event, index) => {
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {
      const topics = rawLog.topics.map((i) => `0x${i}`);
      const data = `0x${rawLog.data}`;
      const OutputBytecode = abi.decodeEvent(MetaData.Exchange.Abi[17],
        data,
        topics);
      if (OutputBytecode._eventName === 'OrderCancelled') {
        const removeNewOrderDB = new Promise(async (resolve) => {
          try {
            const cancelOrder = new CancelOrder(blockNum, txid, OutputBytecode).translate();
            const orderId = cancelOrder.orderId;
            await DBHelper.updateCanceledOrdersByQuery(db.NewOrder, { orderId }, cancelOrder);
            sendCanceledOrderInfo(cancelOrder);
            resolve();
          } catch (err) {
            getLogger().error(`ERROR: ${err.message}`);
            resolve();
          }
        });
        createCancelOrderPromises.push(removeNewOrderDB);
      }
    });
  });

  await Promise.all(createCancelOrderPromises);
};

const syncOrderFulfilled = async (startBlock, endBlock, removeHexPrefix) => {
  let result;
  try {
    result = await getInstance().searchLogs(
      startBlock, endBlock, MetaData.Exchange.Address,
      [MetaData.Exchange.OrderFulfilled], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog OrderFulfilled');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }

  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${result.length} entries from OrderFulfilled`);
  const createFulfillOrderPromises = [];

  _.forEach(result, (event, index) => {
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {
      const topics = rawLog.topics.map((i) => `0x${i}`);
      const data = `0x${rawLog.data}`;
      const OutputBytecode = abi.decodeEvent(MetaData.Exchange.Abi[18],
        data,
        topics);
      if (OutputBytecode._eventName === 'OrderFulfilled') {
        if (parseInt(OutputBytecode._time.toString(10), 10) > 10000000) {
          const fulfillOrderDB = new Promise(async (resolve) => {
            try {
              const fulfillOrder = new FulfillOrder(blockNum, txid, OutputBytecode).translate();
              const orderId = fulfillOrder.orderId;
              await DBHelper.updateFulfilledOrdersByQuery(db.NewOrder, { orderId }, fulfillOrder);
              // await DBHelper.removeOrdersByQuery(db.NewOrder, { orderId: fulfillOrder.orderId });
              const getOrder = await DBHelper.findOne(db.NewOrder, { orderId });
              sendFulfilledOrderInfo(getOrder);
              resolve();
            } catch (err) {
              getLogger().error(`ERROR: ${err.message}`);
              resolve();
            }
          });
          createFulfillOrderPromises.push(fulfillOrderDB);
        }
      }
    });
  });

  await Promise.all(createFulfillOrderPromises);
};

const addTrade = async (rawLog, blockNum, txid) => {
  const getOrder = await DBHelper.findOne(db.NewOrder, { orderId: rawLog._orderId.toString(10) });
  const trade = new Trade(blockNum, txid, rawLog, getOrder).translate();
  const orderId = trade.orderId;
  const newAmount = Number(getOrder.amount) - Number(trade.soldTokens);
  const updateOrder = {
    amount: newAmount,
  };
  try {
    if (await DBHelper.getCount(db.Trade, { txid }) > 0) {
      await DBHelper.updateTradeByQuery(db.Trade, { txid }, trade);
    } else {
      await DBHelper.insertTopic(db.Trade, trade);
    }
    await DBHelper.updateTradeOrderByQuery(db.NewOrder, { orderId }, updateOrder);

    let changeOHLC = {};

    await forEach(timeTable, async (t) => {
      console.log(t);
      if (await DBHelper.getCount(db.Charts, { tokenAddress: trade.tokenAddress, timeTable: t }) > 0) {
        let ohlc = await db.Charts.cfind({
          tokenAddress: trade.tokenAddress,
          timeTable: t,
          time: { $lt: trade.time },
        }).sort({ time: -1 }).limit(1).exec();

        if (trade.time - timeFrame[t] > ohlc[0].time) {
          await insertEmptyCandles(trade.time, t, trade.tokenAddress).then(async () => {
            ohlc = await db.Charts.cfind({
              tokenAddress: trade.tokenAddress,
              timeTable: t,
              time: { $lt: trade.time },
            }).sort({ time: -1 }).limit(1).exec();

            changeOHLC = {
              tokenAddress: trade.tokenAddress,
              timeTable: t,
              time: ohlc[0].time,
              open: ohlc[0].open,
              close: trade.price,
              volume: ohlc[0].volume + parseInt(trade.amount, 10),
            };
            if (trade.price > ohlc[0].high) {
              changeOHLC.high = trade.price;
            } else {
              changeOHLC.high = ohlc[0].high;
            }
            if (trade.price < ohlc[0].low) {
              changeOHLC.low = trade.price;
            } else {
              changeOHLC.low = ohlc[0].low;
            }
            await DBHelper.updateObjectByQuery(db.Charts, { time: ohlc[0].time, timeTable: t }, changeOHLC);
            sendChartInfo(changeOHLC);
          });
        } else {
          changeOHLC = {
            tokenAddress: trade.tokenAddress,
            timeTable: t,
            time: ohlc[0].time,
            open: ohlc[0].open,
            close: trade.price,
            volume: ohlc[0].volume + parseInt(trade.amount, 10),
          };
          if (trade.price > ohlc[0].high) {
            changeOHLC.high = trade.price;
          } else {
            changeOHLC.high = ohlc[0].high;
          }
          if (trade.price < ohlc[0].low) {
            changeOHLC.low = trade.price;
          } else {
            changeOHLC.low = ohlc[0].low;
          }
          await DBHelper.updateObjectByQuery(db.Charts, { time: ohlc[0].time, timeTable: t }, changeOHLC);
          sendChartInfo(changeOHLC);
        }
      }
    });

    // GraphQl push Subs
    sendTradeInfo(trade);
    sendSellHistoryInfo(trade);
    sendBuyHistoryInfo(trade);

    getLogger().debug('Trade Inserted');
    return trade;
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
  }
};

async function topicFiller(topics) {
  try {
    if (topics.length < 4) {
      topics.push(fill.topic);
      return await topicFiller(topics);
    }
    return topics;
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
  }
}

const syncTrade = async (startBlock, endBlock, removeHexPrefix) => {
  let topics;
  let data;
  let result;
  try {
    result = await getInstance().searchLogs(
      startBlock, endBlock, MetaData.Exchange.Address,
      [MetaData.Exchange.Trade], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog syncTrade');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }

  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${result.length} entries from syncTrade`);

  //await forEach(result, async (event) => {
  //  const blockNum = event.blockNumber;
  //  const txid = event.transactionHash;
  //  await forEach(event.log, async (rawLog) => {
  //    try {
  //      topics = rawLog.topics.map((i) => `0x${i}`);
  //      data = `0x${rawLog.data}`;
  //      topics = await topicFiller(topics);
  //      const OutputBytecode = await abi.decodeEvent(MetaData.Exchange.Abi[20], data, topics);
  //      if (OutputBytecode._eventName === 'Trade' && parseInt(OutputBytecode._time.toString(10), 10) !== 0) {
  //        await addTrade(OutputBytecode, blockNum, txid);
  //      }
  //    } catch (error) {
  //      getLogger().error(`ERROR: ${error.message}`);
  //      return;
  //    }
  //  });
  //});

  for (const event of result) {
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    for (const rawLog of event.log) {
      try {
        topics = rawLog.topics.map((i) => `0x${i}`);
        data = `0x${rawLog.data}`;
        topics = await topicFiller(topics);
        const OutputBytecode = await abi.decodeEvent(MetaData.Exchange.Abi[20], data, topics);
        if (OutputBytecode._eventName === 'Trade' && parseInt(OutputBytecode._time.toString(10), 10) !== 0) {
          await addTrade(OutputBytecode, blockNum, txid);
        }
      } catch (error) {
        getLogger().error(`ERROR: ${error.message}`);
        return;
      }
    }
  }
};

const getPercentageChange = (oldNumber, newNumber) => {
  const decreaseValue = oldNumber - newNumber;
  return (decreaseValue / oldNumber) * 100;
};

const syncMarkets = async () => {
  const createMarketPromises = [];
  const marketDB = new Promise(async (resolve) => {
    try {
      const markets = await db.Markets.find({});
      Object.keys(markets).forEach(async (key) => {
        let change = 0;
        let volume = 0;
        let filled = 0;
        let minSellPrice = 0;
        const dateTime = parseInt(moment().unix() - timeFrame.d, 10); // 24 Hours
        const trades = await DBHelper.find(
          db.Trade,
          {
            $and: [
              { time: { $gt: dateTime } },
              { token: markets[key].market },
            ],
          },
          ['time', 'tokenName', 'date', 'price', 'amount', 'orderType', 'boughtTokens', 'soldTokens'],
        );
        const sortedTrades = trades.sort((a, b) => a.time - b.time);
        const first = _.first(sortedTrades);
        const last = _.last(sortedTrades);
        if (first !== undefined && last !== undefined) {
          change = getPercentageChange(last.price, first.price);
        } else {
          change = 0;
        }

        Object.keys(sortedTrades).forEach((trade) => {
          if (sortedTrades[trade].orderType === 'SELLORDER') {
            filled = sortedTrades[trade].boughtTokens / 1e8;
            volume += filled;
          }
          if (sortedTrades[trade].orderType === 'BUYORDER') {
            filled = sortedTrades[trade].soldTokens / 1e8;
            volume += filled;
          }
        });

        const orders = await DBHelper.find(
          db.NewOrder,
          {
            $and: [
              { token: markets[key].market },
              { status: orderState.ACTIVE },
              { orderType: 'SELLORDER' },
            ],
          },
          ['status', 'tokenName', 'price'],
        );

        if (orders !== undefined) {
          minSellPrice = Math.min(...orders.map((order) => order.price));
        }
        if (minSellPrice === Infinity) {
          minSellPrice = 0;
        }

        const obj = {
          market: markets[key].market,
          change: change.toFixed(2),
          volume,
          tokenName: markets[key].tokenName,
          price: minSellPrice,
          address: markets[key].address,
          abi: markets[key].abi,
        };

        await DBHelper.updateMarketsByQuery(db.Markets, { market: obj.market }, obj);
      });

      // await DBHelper.updateMarketsByQuery(db.Markets, { market: obj.market }, obj);
      // await DBHelper.updateOrderByQuery(db.NewOrder, { orderId }, updateOrder);
      getLogger().debug('Markets Synced');
      resolve();
    } catch (err) {
      getLogger().error(`ERROR: ${err.message}`);
      resolve();
    }
  });
  createMarketPromises.push(marketDB);
  await Promise.all(createMarketPromises);
};

const syncFundRedeem = async (startBlock, endBlock, removeHexPrefix) => {
  let resultFund;
  let resultRedeem;
  try {
    resultFund = await getInstance().searchLogs(
      startBlock, endBlock, MetaData.Exchange.Address,
      [MetaData.Exchange.Deposit], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog syncFund');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }
  try {
    resultRedeem = await getInstance().searchLogs(
      startBlock, endBlock, MetaData.Exchange.Address,
      [MetaData.Exchange.Withdrawal], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog syncRedeem');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }
  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${resultRedeem.length} entries from syncRedeem`);
  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${resultFund.length} entries from syncFund`);

  const createFundPromises = [];
  const createRedeemPromises = [];
  const markets = await db.Markets.find({});

  _.forEach(resultFund, (event, index) => {
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {
      const topics = rawLog.topics.map((i) => `0x${i}`);
      const data = `0x${rawLog.data}`;
      const OutputBytecode = abi.decodeEvent(MetaData.Exchange.Abi[14],
        data,
        topics);

      if (OutputBytecode._eventName === 'Deposit' && parseInt(OutputBytecode._time.toString(10), 10) !== 64) {
        const fundDB = new Promise(async (resolve) => {
          try {
            const fund = new FundRedeem(blockNum, txid, OutputBytecode, markets, MetaData.BaseCurrency).translate();
            if (await DBHelper.getCount(db.FundRedeem, { txid }) > 0) {
              await DBHelper.updateFundRedeemByQuery(db.FundRedeem, { txid }, fund);
            } else {
              await DBHelper.insertTopic(db.FundRedeem, fund);
            }
            sendFundRedeemInfo(fund);
            resolve();
          } catch (err) {
            getLogger().error(`ERROR: ${err.message}`);
            resolve();
          }
        });
        createFundPromises.push(fundDB);
      }
    });
  });

  _.forEach(resultRedeem, (event, index) => {
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {
      const topics = rawLog.topics.map((i) => `0x${i}`);
      const data = `0x${rawLog.data}`;
      const OutputBytecode = abi.decodeEvent(MetaData.Exchange.Abi[15],
        data,
        topics);
      if (OutputBytecode._eventName === 'Withdrawal' && parseInt(OutputBytecode._time.toString(10), 10) !== 64) {
        const redeemDB = new Promise(async (resolve) => {
          try {
            const redeem = new FundRedeem(blockNum, txid, OutputBytecode, markets, MetaData.BaseCurrency).translate();
            if (await DBHelper.getCount(db.FundRedeem, { txid }) > 0) {
              await DBHelper.updateFundRedeemByQuery(db.FundRedeem, { txid }, redeem);
            } else {
              await DBHelper.insertTopic(db.FundRedeem, redeem);
            }
            sendFundRedeemInfo(redeem);
            resolve();
          } catch (err) {
            getLogger().error(`ERROR: ${err.message}`);
            resolve();
          }
        });
        createRedeemPromises.push(redeemDB);
      }
    });
  });

  await Promise.all(createFundPromises);
  await Promise.all(createRedeemPromises);
};

const syncMarketMaker = async (startBlock, endBlock, removeHexPrefix) => {
  let result;
  try {
    result = await getInstance().searchLogs(
      startBlock, endBlock, MetaData.Exchange.Address,
      [MetaData.Exchange.Trade], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog syncMarketMaker');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }

  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${result.length} entries from syncMarketMaker`);
  const createMarketMakerPromises = [];

  _.forEach(result, (event, index) => {
    console.log(index);
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {
      if (rawLog._eventName === 'MarketMaker') {
        const removeNewOrderDB = new Promise((resolve) => {
          try {
            const marketMaker = new MarketMaker(blockNum, txid, rawLog).translate();
            console.log(marketMaker);
            // await DBHelper.removeOrdersByQuery(eb.NewOrder, { orderId: cancelOrder.orderId });
            resolve();
          } catch (err) {
            getLogger().error(`ERROR: ${err.message}`);
            resolve();
          }
        });
        createMarketMakerPromises.push(removeNewOrderDB);
      }
    });
  });

  await Promise.all(createMarketMakerPromises);
};

const sync = async () => {
  const removeHexPrefix = true;
  const currentBlockCount = Math.max(0, await getInstance().getBlockCount());
  const currentBlockHash = await getInstance().getBlockHash(currentBlockCount);
  const currentBlockTime = (await getInstance().getBlock(currentBlockHash)).time;

  // Start sync based on last block written to DB
  let startBlock = MetaData.contractDeployedBlock;
  const blocks = await db.Blocks.cfind({}).sort({ blockNum: -1 }).limit(1).exec();
  if (blocks.length > 0) {
    startBlock = Math.max(blocks[0].blockNum + 1, startBlock);
  }

  const numOfIterations = Math.ceil(((currentBlockCount - startBlock) + 1) / BLOCK_BATCH_SIZE);

  sequentialLoop(
    numOfIterations,
    async (loop) => {
      await updateStatusDB.updatePendingTxs(db, currentBlockCount);
      getLogger().debug('Tx DB Updated');

      await updateStatusDB.updatePendingOrders(db, currentBlockCount);
      getLogger().debug('Order DB Updated');

      await updateStatusDB.updatePendingFundRedeems(db, currentBlockCount);
      getLogger().debug('FundRedeem DB Updated');

      await updateStatusDB.updatePendingTrades(db, currentBlockCount);
      getLogger().debug('Trades DB Updated');

      const endBlock = Math.min((startBlock + BLOCK_BATCH_SIZE) - 1, currentBlockCount);

      await syncTokenListingCreated(startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncTokenListingCreated');

      await syncTokenListingUpdated(startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncTokenListingUpdated');

      await syncTokenListingDeleted(startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncTokenListingDeleted');

      await syncFundRedeem(startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced FundRedeem');

      await syncNewOrder(startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced NewOrder');

      await syncMarketMaker(startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncMarketMaker');

      await syncOrderCancelled(startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncOrderCancelled');

      await syncOrderFulfilled(startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncOrderFulfilled');

      await syncMarkets();
      getLogger().debug('Synced markets');

      await syncTrade(startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncTrade');


      const { insertBlockPromises } = await getInsertBlockPromises(startBlock, endBlock);
      await Promise.all(insertBlockPromises);
      getLogger().debug('Inserted Blocks');

      startBlock = endBlock + 1;
      loop.next();
    },
    async () => {
      if (numOfIterations > 0) {
        sendSyncInfo(
          currentBlockCount,
          currentBlockTime,
          await calculateSyncPercent(currentBlockCount, currentBlockTime),
          await network.getPeerNodeCount(),
          await getAddressBalances(),
        );
      }
      getLogger().debug('sleep');
      setTimeout(startSync, 5000);
      await updateEmptyCandles();
    },
  );
};

async function startSync() {
  MetaData = await getContractMetadata();
  senderAddress = isMainnet() ? 'RKBLGRvYqunBtpueEPuXzQQmoVsQQTvd3a' : '5VMGo2gGHhkW5TvRRtcKM1RkyUgrnNP7dn';
  sync();
}

module.exports = {
  startSync,
  calculateSyncPercent,
  getAddressBalances,
};
