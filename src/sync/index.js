/* eslint no-underscore-dangle: [2, { "allow": ["_eventName"] }] */

const fs = require('fs-extra');

const _ = require('lodash');
const moment = require('moment');
const BigNumber = require('bignumber.js');
const async = require('async');
const Web3 = require('web3');
const abi = require('ethjs-abi');
const pubsub = require('../pubsub');
const {
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

const web3 = new Web3();

// Example to hash event functions
// console.log(Web3.utils.sha3('ListingCreated(address,string,string,string,uint8,uint8,uint256)'))

const RPC_BATCH_SIZE = 5;
const BLOCK_BATCH_SIZE = 200;
const SYNC_THRESHOLD_SECS = 1200;

// hardcode sender address as it doesnt matter
let MetaData;
let senderAddress;

const tables = ['1h', '3h', '6h', '12h', 'd', 'w'];
const looptimes = [];
looptimes['1h'] = 3600;
looptimes['3h'] = 10800;
looptimes['6h'] = 21600;
looptimes['12h'] = 43200;
looptimes.d = 86400;
looptimes.w = 604800;

const insertEmptyCandles = async (timeNow, t, address) => new Promise((resolve) => {
  const f = async () => {
    const ohlc = await db.Charts.cfind({ tokenAddress: address, timeTable: t }).sort({ time: -1 }).limit(1).exec();
    // console.log('timeNow: ' + (timeNow - looptimes[t]));
    // console.log('ohlc[0].time: ' + ohlc[0].time);

    if (timeNow - looptimes[t] > ohlc[0].time) {
      const ohlc_change = {
        tokenAddress: address,
        timeTable: t,
        time: ohlc[0].time + looptimes[t],
        open: ohlc[0].close,
        high: ohlc[0].close,
        low: ohlc[0].close,
        close: ohlc[0].close,
        volume: 0,
      };
      await db.Charts.insert(ohlc_change);
      sendChartInfo(
        ohlc_change.tokenAddress,
        ohlc_change.timeTable,
        ohlc_change.time,
        ohlc_change.open,
        ohlc_change.high,
        ohlc_change.low,
        ohlc_change.close,
        ohlc_change.volume
      );
      f();
    } else {
      resolve();
    }
  };
  f();
});

const updateEmptyCandles = async (db) => {
  const markets = await db.Markets.find({});
  const timeNow = parseInt(moment().unix(), 10);

  for (market of markets) {
    for (t of tables) {
      await insertEmptyCandles(timeNow, t, market.address);
    }
  }
};

function sequentialLoop(iterations, process, exit) {
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
}

const startSync = async () => {
  MetaData = await getContractMetadata();
  senderAddress = isMainnet() ? 'RKBLGRvYqunBtpueEPuXzQQmoVsQQTvd3a' : '5VMGo2gGHhkW5TvRRtcKM1RkyUgrnNP7dn';
  sync(db);
};

async function sync(db) {
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

      await syncTokenListingCreated(db, startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncTokenListingCreated');

      await syncTokenListingUpdated(db, startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncTokenListingUpdated');

      await syncTokenListingDeleted(db, startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncTokenListingDeleted');

      await syncFundRedeem(db, startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced FundRedeem');

      await syncNewOrder(db, startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced NewOrder');

      await syncMarketMaker(startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncMarketMaker');

      await syncOrderCancelled(db, startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncOrderCancelled');

      await syncOrderFulfilled(db, startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncOrderFulfilled');

      await syncMarkets(db, startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced markets');

      await syncTrade(db, startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced syncTrade');


      const { insertBlockPromises } = await getInsertBlockPromises(db, startBlock, endBlock);
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
      setTimeout(updateEmptyCandles, 200000, db);
      // execute rpc batch by batch
    },
  );
}

async function syncTokenListingCreated(db, startBlock, endBlock, removeHexPrefix) {
  const blockchainDataPath = Utils.getDataDir();
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
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
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
              const getMarket = await DBHelper.findOne(db.Markets, { address: marketAddress });
              await DBHelper.updateMarketByQuery(db.Markets, { address: marketAddress }, market);
            } else {
              for (t of tables) {
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
              }
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
}

async function syncTokenListingUpdated(db, startBlock, endBlock, removeHexPrefix) {
  const blockchainDataPath = Utils.getDataDir();
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
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {
      const topics = rawLog.topics.map((i) => `0x${i}`);
      const data = `0x${rawLog.data}`;
      const OutputBytecode = abi.decodeEvent(MetaData.Registery.Abi[8], data, topics);

      if (OutputBytecode._eventName === 'ListingUpdated') {
        const insertListingUpdated = new Promise(async (resolve) => {
          try {
            const market = new Market(OutputBytecode).translate();
            const marketAddress = market.address;

            if (await DBHelper.getCount(db.Markets, { address: marketAddress }) > 0) {
              const getMarket = await DBHelper.findOne(db.Markets, { address: marketAddress });
              // / Rename Chart File
              const oldSrc = `${blockchainDataPath}/${getMarket.market}.tsv`;
              const newSrc = `${blockchainDataPath}/${market.market}.tsv`;
              if (oldSrc !== newSrc) {
                fs.rename(oldSrc, newSrc, (err) => {
                  if (err) throw err;
                });
              }
              await DBHelper.updateMarketByQuery(db.Markets, { address: marketAddress }, market);
              // /
            } else {
              db.Markets.insert(market).then((value) => {
                // / init Chart File
                const addMarket = market.market;
                const dataSrc = `${blockchainDataPath}/${addMarket}.tsv`;
                if (!fs.existsSync(dataSrc)) {
                  fs.writeFile(dataSrc, 'date\topen\thigh\tlow\tclose\tvolume\n2018-01-01\t0\t0\t0\t0\t0\n2018-01-02\t0\t0\t0\t0\t0\n', { flag: 'w' }, (err) => {
                    if (err) return console.error(err);
                  });
                }
                fs.closeSync(fs.openSync(dataSrc, 'a'));
                // /
              });
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
        ListingUpdatedPromises.push(insertListingUpdated);
      }
    });
  });
  await Promise.all(ListingUpdatedPromises);
}

async function syncTokenListingDeleted(db, startBlock, endBlock, removeHexPrefix) {
  const blockchainDataPath = Utils.getDataDir();
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
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
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
}

// Gets all promises for new blocks to insert
async function getInsertBlockPromises(db, startBlock, endBlock) {
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
}

async function peerHighestSyncedHeader() {
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
}

async function calculateSyncPercent(blockCount, blockTime) {
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
}

// Send syncInfo subscription
function sendSyncInfo(syncBlockNum, syncBlockTime, syncPercent, peerNodeCount, addressBalances) {
  pubsub.publish('onSyncInfo', {
    onSyncInfo: {
      syncBlockNum,
      syncBlockTime,
      syncPercent,
      peerNodeCount,
      addressBalances,
    },
  });
}

async function getAddressBalances() {
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
          runebase: new BigNumber(addressArrItem[1]).multipliedBy(SATOSHI_CONVERSION).toString(10),
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
      const BalancePromises = [];
      const ExchangeBasePromises = [];
      const ExchangeTokenPromises = [];
      const StringPromises = [];
      const markets = await db.Markets.find({});

      _.map(addressBatches[loop.iteration()], async (address) => {
        const ExchangeBasePromise = new Promise(async (ExchangeBaseResolve) => {
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
            found.Exchange[MetaData.BaseCurrency.Pair] = await new BigNumber(Balance).dividedBy(SATOSHI_CONVERSION).toString(10);
            ExchangeBaseResolve();
          } catch (err) {
            getLogger().error(`BalanceOf ${address}: ${err.message}`);
          }
        });
        ExchangeBasePromises.push(ExchangeBasePromise);
      });
      await Promise.all(ExchangeBasePromises);

      _.map(addressBatches[loop.iteration()], async (address) => {
        const ExchangeTokenPromise = new Promise(async (ExchangeTokenResolver) => {
          let ExchangeTokenCounter = 0;
          for (const ExchangeToken of markets) {
            try {
              console.log(ExchangeToken);
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
              found.Exchange[ExchangeToken.market] = await new BigNumber(Balance).dividedBy(10 ** ExchangeToken.decimals).toString(10);
              ExchangeTokenCounter++;
              if (ExchangeTokenCounter == Object.keys(markets).length) {
                getLogger().debug('Exchange Token Parent Done');
                ExchangeTokenResolver();
              }
            } catch (err) {
              getLogger().error(`BalanceOf ${address}: ${err.message}`);
            }
          }
        });
        ExchangeTokenPromises.push(ExchangeTokenPromise);
      });
      await Promise.all(ExchangeTokenPromises);

      _.map(addressBatches[loop.iteration()], async (address) => {
        const WalletTokenPromise = new Promise(async (WalletTokenResolve) => {
          let WalletTokenCounter = 0;
          for (const WalletToken of markets) {
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
              WalletTokenCounter++;
              if (WalletTokenCounter == Object.keys(markets).length) {
                getLogger().debug('Wallet Token Parent Done');
                WalletTokenResolve();
              }
            } catch (err) {
              getLogger().error(`BalanceOf ${address}: ${err.message}`);
            }
          }
        });

        BalancePromises.push(WalletTokenPromise);
      });
      await Promise.all(BalancePromises);

      _.map(addressBatches[loop.iteration()], async (address) => {
        const StringPromise = new Promise(async (StringResolve) => {
          async.forEach(markets, async (ExchangeToken, callback) => {
            try {
              const found = await _.find(addressObjs, { address });
              found.balance = JSON.stringify(found);
              StringResolve();
            } catch (err) {
              getLogger().error(`BalanceOf ${address}: ${err.message}`);
            }
          });
        });

        StringPromises.push(StringPromise);
      });
      await Promise.all(StringPromises);
      loop.next();
    }, () => {
      resolve();
    });
  });

  // /////////////////////////////////////////////////////////

  // Add default address with zero balances if no address was used before ¯\_(ツ)_/¯
  if (_.isEmpty(addressObjs)) {
    let address;
    let addressWithLabel;
    const myEmptyObject = {};
    const emptyObject = {};
    try {
      try {
        address = await wallet.getAddressesByLabel('default');
      } catch (err) {
        if (err.response.status == 500) {
          try {
            console.log(`${err.response.status}: No Wallet found, Creating new...`);
            address = await wallet.getNewAddress('default');
          } catch (err) {
            console.log(err);
          }
        }
      }

      address = Object.keys(address)[0];

      emptyObject.address = Object.keys(address)[0];
      emptyObject.Wallet = {};
      emptyObject.Exchange = {};
      emptyObject.address = address;
      for (EmptyTokenNames in MetaData.Tokens) {
        emptyObject.Exchange[MetaData.Tokens[EmptyTokenNames].Pair] = '0';
        emptyObject.Wallet[MetaData.Tokens[EmptyTokenNames].Pair] = '0';
      }
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
}


async function syncNewOrder(db, startBlock, endBlock, removeHexPrefix) {
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

      if (OutputBytecode._eventName === 'NewOrder' && parseInt(OutputBytecode._time.toString(10)) !== 0) {
        const insertNewOrderDB = new Promise(async (resolve) => {
          try {
            const newOrder = await new NewOrder(blockNum, txid, OutputBytecode, markets, MetaData.BaseCurrency.Address).translate();
            if (await DBHelper.getCount(db.NewOrder, { txid }) > 0) {
              DBHelper.updateOrderByQuery(db.NewOrder, { txid }, newOrder);
            } else {
              DBHelper.insertTopic(db.NewOrder, newOrder);
            }
            sendSellOrderInfo(newOrder.txid, newOrder.orderId, newOrder.owner, newOrder.token, newOrder.tokenName, newOrder.price, newOrder.type, newOrder.orderType, newOrder.sellToken, newOrder.buyToken, newOrder.priceMul, newOrder.priceDiv, newOrder.time, newOrder.amount, newOrder.startAmount, newOrder.blockNum, newOrder.status, newOrder.decimals);
            sendBuyOrderInfo(newOrder.txid, newOrder.orderId, newOrder.owner, newOrder.token, newOrder.tokenName, newOrder.price, newOrder.type, newOrder.orderType, newOrder.sellToken, newOrder.buyToken, newOrder.priceMul, newOrder.priceDiv, newOrder.time, newOrder.amount, newOrder.startAmount, newOrder.blockNum, newOrder.status, newOrder.decimals);
            sendActiveOrderInfo(newOrder.txid, newOrder.orderId, newOrder.owner, newOrder.token, newOrder.tokenName, newOrder.price, newOrder.type, newOrder.orderType, newOrder.sellToken, newOrder.buyToken, newOrder.priceMul, newOrder.priceDiv, newOrder.time, newOrder.amount, newOrder.startAmount, newOrder.blockNum, newOrder.status, newOrder.decimals);

            resolve();
          } catch (err) {
            getLogger().error(`ERROR: ${err.message}`);
            resolve();
          }
        });
        createNewOrderPromises.push(insertNewOrderDB);
      }
    });
  });
  await Promise.all(createNewOrderPromises);
}

async function syncOrderCancelled(db, startBlock, endBlock, removeHexPrefix) {
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
            sendCanceledOrderInfo(cancelOrder.txid, cancelOrder.orderId, cancelOrder.owner, cancelOrder.token, cancelOrder.tokenName, cancelOrder.price, cancelOrder.type, cancelOrder.orderType, cancelOrder.sellToken, cancelOrder.buyToken, cancelOrder.priceMul, cancelOrder.priceDiv, cancelOrder.time, cancelOrder.amount, cancelOrder.startAmount, cancelOrder.blockNum, cancelOrder.status, cancelOrder.decimals);
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
}

async function syncOrderFulfilled(db, startBlock, endBlock, removeHexPrefix) {
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
        if (parseInt(OutputBytecode._time.toString(10)) > 10000000) {
          const fulfillOrderDB = new Promise(async (resolve) => {
            try {
              const fulfillOrder = new FulfillOrder(blockNum, txid, OutputBytecode).translate();
              const orderId = fulfillOrder.orderId;
              await DBHelper.updateFulfilledOrdersByQuery(db.NewOrder, { orderId }, fulfillOrder);
              // await DBHelper.removeOrdersByQuery(db.NewOrder, { orderId: fulfillOrder.orderId });
              const getOrder = await DBHelper.findOne(db.NewOrder, { orderId });
              sendFulfilledOrderInfo(getOrder.txid, getOrder.orderId, getOrder.owner, getOrder.token, getOrder.tokenName, getOrder.price, getOrder.type, getOrder.orderType, getOrder.sellToken, getOrder.buyToken, getOrder.priceMul, getOrder.priceDiv, getOrder.time, getOrder.amount, getOrder.startAmount, getOrder.blockNum, getOrder.status, getOrder.decimals);
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
}


function readFile(srcPath) {
  return new Promise(((resolve, reject) => {
    try {
      fs.readFile(srcPath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    } catch (err) {
      getLogger().error(`ERROR: ${err.message}`);
    }
  }));
}


async function addTrade(rawLog, blockNum, txid) {
  const getOrder = await DBHelper.findOne(db.NewOrder, { orderId: rawLog._orderId.toString(10) });
  // const getOrder = await DBHelper.findTradeAndUpdate(db.NewOrder, { orderId: rawLog._orderId.toString(10) }, rawLog._amount.toString());
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

    let ohlc_change = {};

    for (t of tables) {
      if (await DBHelper.getCount(db.Charts, { tokenAddress: trade.tokenAddress, timeTable: t }) > 0) {
        let ohlc = await db.Charts.cfind({ tokenAddress: trade.tokenAddress, timeTable: t, time: { $lt: trade.time } }).sort({ time: -1 }).limit(1).exec();
        if (trade.time - looptimes[t] > ohlc[0].time) {
          await insertEmptyCandles(trade.time, t, trade.tokenAddress).then(async () => {
            ohlc = await db.Charts.cfind({ tokenAddress: trade.tokenAddress, timeTable: t, time: { $lt: trade.time } }).sort({ time: -1 }).limit(1).exec();
            ohlc_change = {
              tokenAddress: trade.tokenAddress,
              timeTable: t,
              time: ohlc[0].time,
              open: ohlc[0].open,
              close: trade.price,
              volume: ohlc[0].volume + parseInt(trade.amount),
            };
            if (trade.price > ohlc[0].high) {
              ohlc_change.high = trade.price;
            } else {
              ohlc_change.high = ohlc[0].high;
            }
            if (trade.price < ohlc[0].low) {
              ohlc_change.low = trade.price;
            } else {
              ohlc_change.low = ohlc[0].low;
            }
            await DBHelper.updateObjectByQuery(db.Charts, { time: ohlc[0].time, timeTable: t }, ohlc_change);
            sendChartInfo(ohlc_change.tokenAddress, ohlc_change.timeTable, ohlc_change.time, ohlc_change.open, ohlc_change.high, ohlc_change.low, ohlc_change.close, ohlc_change.volume);
          });
        } else {
          ohlc_change = {
            tokenAddress: trade.tokenAddress,
            timeTable: t,
            time: ohlc[0].time,
            close: trade.price,
            volume: ohlc[0].volume + parseInt(trade.amount),
          };
          if (trade.price > ohlc[0].high) {
            ohlc_change.high = trade.price;
          } else {
            ohlc_change.high = ohlc[0].high;
          }
          if (trade.price < ohlc[0].low) {
            ohlc_change.low = trade.price;
          } else {
            ohlc_change.low = ohlc[0].low;
          }
          await DBHelper.updateObjectByQuery(db.Charts, { time: ohlc[0].time, timeTable: t }, ohlc_change);
          sendChartInfo(ohlc_change.tokenAddress, ohlc_change.timeTable, ohlc_change.time, ohlc[0].open, ohlc_change.high, ohlc_change.low, ohlc_change.close, ohlc_change.volume);
        }
      }
    }

    // GraphQl push Subs
    sendTradeInfo(trade.tokenAddress, trade.status, trade.txid, trade.from, trade.to, trade.soldTokens, trade.boughtTokens, trade.token, trade.tokenName, trade.orderType, trade.type, trade.price, trade.orderId, trade.time, trade.amount, trade.blockNum, trade.decimals);
    sendSellHistoryInfo(trade.tokenAddress, trade.status, trade.txid, trade.from, trade.to, trade.soldTokens, trade.boughtTokens, trade.token, trade.tokenName, trade.orderType, trade.type, trade.price, trade.orderId, trade.time, trade.amount, trade.blockNum, trade.decimals);
    sendBuyHistoryInfo(trade.tokenAddress, trade.status, trade.txid, trade.from, trade.to, trade.soldTokens, trade.boughtTokens, trade.token, trade.tokenName, trade.orderType, trade.type, trade.price, trade.orderId, trade.time, trade.amount, trade.blockNum, trade.decimals);

    getLogger().debug('Trade Inserted');
    return trade;
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
  }
}

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

async function syncTrade(db, startBlock, endBlock, removeHexPrefix) {
  const createTradePromises = [];
  let topics;
  let data;
  let results;
  let result;
  const blockchainDataPath = Utils.getDataDir();
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

  for (const event of result) {
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    for (const rawLog of event.log) {
      topics = rawLog.topics.map((i) => `0x${i}`);
      data = `0x${rawLog.data}`;
      topics = await topicFiller(topics);
      const OutputBytecode = await abi.decodeEvent(MetaData.Exchange.Abi[20], data, topics);

      if (OutputBytecode._eventName === 'Trade' && parseInt(OutputBytecode._time.toString(10)) !== 0) {
        const trade = await addTrade(OutputBytecode, blockNum, txid);
      }
    }
  }
}

function dynamicSort(property) {
  let sortOrder = 1;
  if (property[0] === '-') {
    sortOrder = -1;
    property = property.substr(1);
  }
  return function (a, b) {
    if (sortOrder == -1) {
      return b[property].toString().localeCompare(a[property]);
    }
    return a[property].toString().localeCompare(b[property]);
  };
}

function getPercentageChange(oldNumber, newNumber) {
  const decreaseValue = oldNumber - newNumber;
  return (decreaseValue / oldNumber) * 100;
}

async function syncMarkets(db, startBlock, endBlock, removeHexPrefix) {
  const createMarketPromises = [];
  const marketDB = new Promise(async (resolve) => {
    try {
      const markets = await db.Markets.find({});
      let change = 0;
      let volume = 0;
      let filled = 0;
      let minSellPrice = 0;
      for (const key in markets) {
        change = 0;
        volume = 0;
        filled = 0;
        minSellPrice = 0;
        const unixTime = Date.now();
        const inputDate = unixTime - 84600000; // 24 hours
        const trades = await DBHelper.find(
          db.Trade,
          {
            $and: [
              { date: { $gt: new Date(inputDate) } },
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
        for (trade in sortedTrades) {
          if (sortedTrades[trade].orderType === 'SELLORDER') {
            filled = sortedTrades[trade].boughtTokens / 1e8;
            volume += filled;
          }
          if (sortedTrades[trade].orderType === 'BUYORDER') {
            filled = sortedTrades[trade].soldTokens / 1e8;
            volume += filled;
          }
        }
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
          minSellPrice = Math.min.apply(Math, orders.map((order) => order.price));
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
      }
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
}

async function syncFundRedeem(db, startBlock, endBlock, removeHexPrefix) {
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

      if (OutputBytecode._eventName === 'Deposit' && parseInt(OutputBytecode._time.toString(10)) !== 64) {
        const fundDB = new Promise(async (resolve) => {
          try {
            const fund = new FundRedeem(blockNum, txid, OutputBytecode, markets, MetaData.BaseCurrency).translate();
            if (await DBHelper.getCount(db.FundRedeem, { txid }) > 0) {
              await DBHelper.updateFundRedeemByQuery(db.FundRedeem, { txid }, fund);
            } else {
              await DBHelper.insertTopic(db.FundRedeem, fund);
            }
            sendFundRedeemInfo(
              fund.txid,
              fund.type,
              fund.token,
              fund.tokenName,
              fund.status,
              fund.owner,
              fund.time,
              fund.amount,
              fund.blockNum,
            );
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
      if (OutputBytecode._eventName === 'Withdrawal' && parseInt(OutputBytecode._time.toString(10)) !== 64) {
        const redeemDB = new Promise(async (resolve) => {
          try {
            const redeem = new FundRedeem(blockNum, txid, OutputBytecode, markets, MetaData.BaseCurrency).translate();
            if (await DBHelper.getCount(db.FundRedeem, { txid }) > 0) {
              await DBHelper.updateFundRedeemByQuery(db.FundRedeem, { txid }, redeem);
            } else {
              await DBHelper.insertTopic(db.FundRedeem, redeem);
            }
            sendFundRedeemInfo(
              redeem.txid,
              redeem.type,
              redeem.token,
              redeem.tokenName,
              redeem.status,
              redeem.owner,
              redeem.time,
              redeem.amount,
              redeem.blockNum,
            );
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
}

async function syncMarketMaker(startBlock, endBlock, removeHexPrefix) {
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
}

module.exports = {
  startSync,
  calculateSyncPercent,
  getAddressBalances,
};
