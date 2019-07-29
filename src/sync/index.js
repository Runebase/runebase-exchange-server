/* eslint no-underscore-dangle: [2, { "allow": ["_eventName"] }] */

const fs = require('fs-extra');

const _ = require('lodash');
const pubsub = require('../pubsub');
const { getLogger } = require('../utils/logger');
//const { Utils } = require('rweb3');
const moment = require('moment');
const BigNumber = require('bignumber.js');
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
const OrderFulfilled = require('../models/orderFulfilled');
const Token = require('../api/token');
const wallet = require('../api/wallet');
const network = require('../api/network');
const exchange = require('../api/exchange');
const { getInstance } = require('../rclient');
const { txState, orderState } = require('../constants');
const async = require("async");
const Web3 = require('web3')
const web3 = new Web3();
const abi = require('ethjs-abi');

const RPC_BATCH_SIZE = 5;
const BLOCK_BATCH_SIZE = 200;
const SYNC_THRESHOLD_SECS = 1200;

// hardcode sender address as it doesnt matter
let MetaData;
let senderAddress;

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

      await syncFundRedeem(db, startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced FundRedeem');

      await syncNewOrder(db, startBlock, endBlock, removeHexPrefix);
      getLogger().debug('Synced NewOrder');

      await syncMarketMaker(db, startBlock, endBlock, removeHexPrefix);
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
      // execute rpc batch by batch
    },
  );
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
          RUNES: new BigNumber(addressArrItem[1]).multipliedBy(SATOSHI_CONVERSION).toString(10),
          runebase: new BigNumber(addressArrItem[1]).multipliedBy(SATOSHI_CONVERSION).toString(10),
          Wallet: {
            RUNES: new BigNumber(addressArrItem[1]).multipliedBy(SATOSHI_CONVERSION).toString(10),
          },
          Exchange: {},
        });
        addressList.push(addressArrItem[0]);
      });
    });
  } catch (err) {
    getLogger().error(`listAddressGroupings: ${err.message}`);
  }
  ////////////////////////////////////////////////////////////
  const addressBatches = _.chunk(addressList, RPC_BATCH_SIZE);
  await new Promise(async (resolve) => {
    sequentialLoop(addressBatches.length, async (loop) => {
      const BalancePromises = [];
      const StringPromises = [];

      _.map(addressBatches[loop.iteration()], async (address) => {
        const ExchangeTokenPromise = new Promise(async (ExchangeTokenResolver) => {
          let ExchangeTokenCounter = 0;
          async.forEach(MetaData['Tokens'], async function(ExchangeToken, callback) {
            try {
              let Balance = new BigNumber(0);
              const hex = await getInstance().getHexAddress(address);
              const resp = await exchange.balanceOf({
                token: ExchangeToken['Address'],
                user: hex,
                senderAddress: address,
                exchangeAddress: MetaData['Exchange']['Address'],
                abi: MetaData['Exchange']['Abi'],
              });
              Balance = Utils.hexToDecimalString(resp.executionResult.formattedOutput[0]);
              const found = await _.find(addressObjs, { address });
              const lowerPair = 'exchange' + ExchangeToken['Pair'].toLowerCase();
              found['Exchange'][ExchangeToken['Pair']] = await Balance.toString(10);
              found[lowerPair] = await Balance.toString(10);
              ExchangeTokenCounter++;
              if (ExchangeTokenCounter == Object.keys(MetaData['Tokens']).length) {
                getLogger().debug('Exchange Token Parent Done');
                ExchangeTokenResolver();
              }
            } catch (err) {
              getLogger().error(`BalanceOf ${address}: ${err.message}`);
            }
          });
        });

        const WalletTokenPromise = new Promise(async (WalletTokenResolve) => {
          let WalletTokenCounter = 0;
          async.forEach(MetaData['Tokens'], async function(WalletToken, callback) {
            try {
              let Balance = await new BigNumber(0);
              const resp = await Token.balanceOf({
                owner: address,
                senderAddress: address,
                token: WalletToken['Pair'],
                tokenAddress: WalletToken['Address'],
                abi: WalletToken['Abi'],
                RrcVersion: WalletToken['Rrc'],
              });
              Balance = resp.balance;
              const found = await _.find(addressObjs, { address });
              const lowerPair = WalletToken['Pair'].toLowerCase();
              found['Wallet'][WalletToken['Pair']] = await Balance.toString(10);
              found[lowerPair] = await Balance.toString(10);
              WalletTokenCounter++;
              if (WalletTokenCounter == Object.keys(MetaData['Tokens']).length) {
                getLogger().debug('Wallet Token Parent Done');
                WalletTokenResolve();
              }
            } catch (err) {
              getLogger().error(`BalanceOf ${address}: ${err.message}`);
            }
          });
        });

        const ExchangeBasePromise = new Promise(async (ExchangeBaseResolve) => {
            let Balance = await new BigNumber(0);
            try {
              const hex = await getInstance().getHexAddress(address);
              const resp = await exchange.balanceOf({
                token: MetaData['BaseCurrency']['Address'],
                user: hex,
                senderAddress: address,
                exchangeAddress: MetaData['Exchange']['Address'],
                abi: MetaData['Exchange']['Abi'],
              });
              Balance = Utils.hexToDecimalString(resp.executionResult.formattedOutput[0]);
              const found = _.find(addressObjs, { address });
              found.exchangerunes = Balance.toString(10);
              found['Exchange']['RUNES'] = Balance.toString(10);
              ExchangeBaseResolve();
            } catch (err) {
              getLogger().error(`BalanceOf ${address}: ${err.message}`);
            }
        });


        BalancePromises.push(ExchangeBasePromise);
        BalancePromises.push(ExchangeTokenPromise);
        BalancePromises.push(WalletTokenPromise);

      });


      await Promise.all(BalancePromises);
      _.map(addressBatches[loop.iteration()], async (address) => {
          const StringPromise = new Promise(async (StringResolve) => {
            async.forEach(MetaData['Tokens'], async function(ExchangeToken, callback) {
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

  ///////////////////////////////////////////////////////////

  // Add default address with zero balances if no address was used before ¯\_(ツ)_/¯
  if (_.isEmpty(addressObjs)) {
    let address;
    let addressWithLabel;
    const myEmptyObject = {};
    const emptyObject = {};
    try {
      try {
        address = await wallet.getAddressesByLabel('default');
        console.log(address);
      } catch (err) {
        if (err.response.status == 500) {
          try {
            console.log(err.response.status + ': No Wallet found, Creating new...');
            address = await wallet.getNewAddress('default');
          } catch (err) {
            console.log(err);
          }
        }
      }

      address = Object.keys(address)[0];

      emptyObject['address'] = Object.keys(address)[0];
      for (EmptyTokenNames in MetaData['Tokens']) {
        lowerCasePair = MetaData['Tokens'][EmptyTokenNames]['Pair'].toLowerCase();
        exchangeLowerCasePair = 'exchange' + lowerCasePair;
        emptyObject[lowerCasePair] = '0';
        emptyObject[exchangeLowerCasePair] = '0';
      }
      emptyObject['RUNES'] = '0';
      emptyObject['exchangerunes'] = '0';

      /////
      emptyObject['Wallet'] = {};
      emptyObject['Exchange'] = {};
      emptyObject['address'] = address;
        for (EmptyTokenNames in MetaData['Tokens']) {
          emptyObject['Exchange'][MetaData['Tokens'][EmptyTokenNames]['Pair']] = '0';
          emptyObject['Wallet'][MetaData['Tokens'][EmptyTokenNames]['Pair']] = '0';
        }
        emptyObject['Exchange']['RUNES'] = '0';
        emptyObject['Wallet']['RUNES'] = '0';
        emptyObject['balance'] = JSON.stringify(emptyObject);
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
  try {
    result = await getInstance().searchLogs(
      startBlock, endBlock, MetaData['Exchange']['Address'],
      [MetaData['Exchange']['NewOrder']], MetaData, removeHexPrefix,
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

      const topics = rawLog.topics.map(i => '0x' + i );
      const data = '0x' + rawLog.data;
      const OutputBytecode = abi.decodeEvent(MetaData['Exchange']['Abi'][16], data, topics);
      console.log('OutputBytecode');
      console.log(OutputBytecode);

      if (OutputBytecode._eventName === 'NewOrder' && parseInt(OutputBytecode._time.toString(10)) !== 0) {
        const insertNewOrderDB = new Promise(async (resolve) => {
          try {
            const newOrder = await new NewOrder(blockNum, txid, OutputBytecode, MetaData['Tokens'], MetaData['BaseCurrency']['Address']).translate();
            if (await DBHelper.getCount(db.NewOrder, { txid }) > 0) {
              DBHelper.updateOrderByQuery(db.NewOrder, { txid }, newOrder);
            } else {
              console.log('inserting Order');
              console.log(newOrder);
              DBHelper.insertTopic(db.NewOrder, newOrder);
            }
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
      startBlock, endBlock, MetaData['Exchange']['Address'],
      [MetaData['Exchange']['OrderCancelled']], MetaData, removeHexPrefix,
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
      const topics = rawLog.topics.map(i => '0x' + i );
      const data = '0x' + rawLog.data;
      const OutputBytecode = abi.decodeEvent(MetaData['Exchange']['Abi'][17],
      data,
      topics);
      console.log('OutputBytecode');
      console.log(OutputBytecode);
      if (OutputBytecode._eventName === 'OrderCancelled') {
        const removeNewOrderDB = new Promise(async (resolve) => {
          try {
            const cancelOrder = new CancelOrder(blockNum, txid, OutputBytecode).translate();
            const orderId = cancelOrder.orderId;
            await DBHelper.updateCanceledOrdersByQuery(db.NewOrder, { orderId }, cancelOrder);
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
      startBlock, endBlock, MetaData['Exchange']['Address'],
      [MetaData['Exchange']['OrderFulfilled']], MetaData, removeHexPrefix,
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
      const topics = rawLog.topics.map(i => '0x' + i );
      const data = '0x' + rawLog.data;
      const OutputBytecode = abi.decodeEvent(MetaData['Exchange']['Abi'][18],
      data,
      topics);
      console.log('OutputBytecode');
      console.log(OutputBytecode);
      if (OutputBytecode._eventName === 'OrderFulfilled') {
        const fulfillOrderDB = new Promise(async (resolve) => {
          try {
            const fulfillOrder = new FulfillOrder(blockNum, txid, OutputBytecode).translate();
            const orderId = fulfillOrder.orderId;
            await DBHelper.updateFulfilledOrdersByQuery(db.NewOrder, { orderId }, fulfillOrder);
            //await DBHelper.removeOrdersByQuery(db.NewOrder, { orderId: fulfillOrder.orderId });
            resolve();
          } catch (err) {
            getLogger().error(`ERROR: ${err.message}`);
            resolve();
          }
        });
        createFulfillOrderPromises.push(fulfillOrderDB);
      }
    });
  });

  await Promise.all(createFulfillOrderPromises);
}



function readFile(srcPath) {
  return new Promise(function (resolve, reject) {
    try {
      fs.readFile(srcPath, 'utf8', function (err, data) {
        if (err) {
          reject(err)
        } else {
          resolve(data);
        }
      });
    } catch (err) {
      getLogger().error(`ERROR: ${err.message}`);
    }
  })
}



async function addTrade(rawLog, blockNum, txid){
  const getOrder = await DBHelper.findOne(db.NewOrder, { orderId: rawLog._orderId.toString(10) });
  //const getOrder = await DBHelper.findTradeAndUpdate(db.NewOrder, { orderId: rawLog._orderId.toString(10) }, rawLog._amount.toString());
  const trade = new Trade(blockNum, txid, rawLog, getOrder).translate();
  const orderId = trade.orderId
  const newAmount = Number(getOrder.amount) - Number(trade.soldTokens);
  const updateOrder = {
    amount: newAmount,
  }
  try {
    if (await DBHelper.getCount(db.Trade, { txid }) > 0) {
      await DBHelper.updateTradeByQuery(db.Trade, { txid }, trade);
    } else {
      console.log('trade');
      console.log(trade);
      await DBHelper.insertTopic(db.Trade, trade)
    }
    console.log('updateOrder');
    console.log(updateOrder);
    await DBHelper.updateTradeOrderByQuery(db.NewOrder, { orderId }, updateOrder);
    getLogger().debug('Trade Inserted');
    return trade;
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
  }
}

async function topicFiller(topics) {
  try {
    if(topics.length < 4){
        topics.push(fill.topic);
        return await topicFiller(topics);
    }
    else return topics;
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
      startBlock, endBlock, MetaData['Exchange']['Address'],
      [MetaData['Exchange']['Trade']], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog syncTrade');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }

  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${result.length} entries from syncTrade`);

  for (let event of result){
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    for (let rawLog of event.log){
      topics = rawLog.topics.map(i => '0x' + i );
      data = '0x' + rawLog.data;
      topics = await topicFiller(topics);
      let OutputBytecode = await abi.decodeEvent(MetaData['Exchange']['Abi'][20], data, topics);

      console.log('OutputBytecode');
      console.log(OutputBytecode);

      if (OutputBytecode._eventName === 'Trade' && parseInt(OutputBytecode._time.toString(10)) !== 0) {
        const trade = await addTrade(OutputBytecode, blockNum, txid).then(trade => new Promise(async (resolve) => {
        const dataSrc = blockchainDataPath + '/' + trade.tokenName + '.tsv';
        if (!fs.existsSync(dataSrc)){
          fs.writeFile(dataSrc, 'date\topen\thigh\tlow\tclose\tvolume\n', { flag: 'w' }, function(err) {
            if (err)
              return console.error(err);
          });
        }
        fs.closeSync(fs.openSync(dataSrc, 'a'));

        results = await readFile(dataSrc);
        const lines = results.trim().split('\n');
        const lastLine = lines.slice(-1)[0];
        const fields = lastLine.split('\t');
        const LastDate = fields.slice(0)[0];
        const LastOpen = fields.slice(0)[1];
        const LastHigh = fields.slice(0)[2];
        const LastLow = fields.slice(0)[3];
        const LastClose = fields.slice(0)[4];
        const LastVolume = fields.slice(0)[5];
        const tradeDate = moment.unix(trade.time).format('YYYY-MM-DD');
        const tradeAmount = trade.amount / 1e8;
        if (LastDate == tradeDate) {
          const newVolume = parseFloat(LastVolume) + parseFloat(tradeAmount);
          let newLow = LastLow;
          let newHigh = LastHigh;
          if (trade.price < LastLow) {
            newLow = trade.price;
          }
          if (trade.price > LastHigh) {
            newHigh= trade.price;
          }
          const upData = tradeDate + '\t' + LastClose + '\t' + newHigh + '\t' + newLow + '\t' + trade.price + '\t' + newVolume.toFixed(8);
          buffer = Buffer.from(upData);

          fs.open(dataSrc, 'a', function(err, fd) {
            if (err) {
              throw 'error opening file: ' + err;
            }
            fs.readFile(dataSrc, 'utf8', function (err,data) {
              if (err) {
                return console.log(err);
              }
              const re = new RegExp(lastLine,"g");
              const result = data.replace(re, upData);
              fs.writeFile(dataSrc, result, 'utf8', function (err) {
                if (err) throw 'error writing file: ' + err;
                  fs.close(fd, function() {
                      resolve();
                  })
                });
              });
            });
          }
          if (LastDate != tradeDate) {
            const newData = tradeDate + '\t' + LastClose + '\t' + trade.price + '\t' + trade.price + '\t' + trade.price + '\t' + tradeAmount.toFixed(8) + '\n' ;
            const buffer = new Buffer(newData);
            fs.open(dataSrc, 'a', function(err, fd) {
                if (err) {
                    throw 'error opening file: ' + err;
                }
                fs.write(fd, buffer, 0, buffer.length, null, function(err) {
                    if (err) throw 'error writing file: ' + err;
                    fs.close(fd, function() {
                        resolve();
                    })
                });
            });
          }
        }));
      }
    }
  }
}

function dynamicSort(property) {
  var sortOrder = 1;
  if(property[0] === "-") {
    sortOrder = -1;
    property = property.substr(1);
  }
  return function (a,b) {
    if(sortOrder == -1){
      return b[property].toString().localeCompare(a[property]);
    } else {
      return a[property].toString().localeCompare(b[property]);
    }
  }
}

function getPercentageChange(oldNumber, newNumber){
  const decreaseValue = oldNumber - newNumber;
  return (decreaseValue / oldNumber) * 100;
}

async function syncMarkets(db, startBlock, endBlock, removeHexPrefix) {
  const createMarketPromises = [];
  const marketDB = new Promise(async (resolve) => {
    try {
      let change = 0;
      let volume = 0;
      let filled = 0;
      let minSellPrice = 0;
      for (var key in MetaData['Tokens']){
            change = 0;
            volume = 0;
            filled = 0;
            minSellPrice = 0;
            const unixTime = Date.now();
            var inputDate = unixTime - 84600000; // 24 hours
            const trades = await DBHelper.find(
                    db.Trade,
                      {
                        $and: [
                        { 'date': { $gt: new Date(inputDate) } },
                        { tokenName: MetaData['Tokens'][key]['Pair'] },
                        ]
                      },
                    ['time', 'tokenName', 'date', 'price', 'amount', 'orderType', 'boughtTokens', 'soldTokens'],
                  );
            const sortedTrades = trades.sort((a, b) => a.time - b.time);
            const first = _.first(sortedTrades);
            const last = _.last(sortedTrades);
            if (first !== undefined && last !== undefined) {
              change = getPercentageChange(last.price, first.price);
            } else{
              change = 0;
            }
            for (trade in sortedTrades) {
              if (sortedTrades[trade].orderType === 'SELLORDER') {
                filled = sortedTrades[trade].boughtTokens / 1e8;
                volume = volume + filled;
              }
              if (sortedTrades[trade].orderType === 'BUYORDER') {
                filled = sortedTrades[trade].soldTokens / 1e8;
                volume = volume + filled;
              }
            }
            const orders = await DBHelper.find(
                    db.NewOrder,
                      {
                        $and: [
                        { tokenName: MetaData['Tokens'][key]['Pair'] },
                        { status: orderState.ACTIVE },
                        { orderType: 'SELLORDER' },
                        ]
                      },
                    ['status', 'tokenName', 'price',],
                  );
            if (orders !== undefined) {
              minSellPrice = Math.min.apply(Math, orders.map(function(order) { return order.price; }));
            }
            if (minSellPrice === Infinity) {
              minSellPrice = 0;
            }
            const obj = {
              market: MetaData['Tokens'][key]['Pair'],
              change: change.toFixed(2),
              volume,
              tokenName: MetaData['Tokens'][key]['TokenName'],
              price: minSellPrice,
              address: MetaData['Tokens'][key]['Address'],
              abi: MetaData['Tokens'][key]['Abi'],
            }
            await DBHelper.updateMarketsByQuery(db.Markets, { market: obj.market }, obj);
      };
      //await DBHelper.updateMarketsByQuery(db.Markets, { market: obj.market }, obj);
      //await DBHelper.updateOrderByQuery(db.NewOrder, { orderId }, updateOrder);
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
      startBlock, endBlock, MetaData['Exchange']['Address'],
      [MetaData['Exchange']['Deposit']], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog syncFund');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }
  try {
    resultRedeem = await getInstance().searchLogs(
      startBlock, endBlock, MetaData['Exchange']['Address'],
      [MetaData['Exchange']['Withdrawal']], MetaData, removeHexPrefix,
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

  _.forEach(resultFund, (event, index) => {
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {

      const topics = rawLog.topics.map(i => '0x' + i );
      const data = '0x' + rawLog.data;
      console.log(MetaData['Exchange']['Abi'][14]);
      const OutputBytecode = abi.decodeEvent(MetaData['Exchange']['Abi'][14],
      data,
      topics);
      console.log('OutputBytecode');
      console.log(OutputBytecode);

      if (OutputBytecode._eventName === 'Deposit') {
        const fundDB = new Promise(async (resolve) => {
          try {
            const fund = new FundRedeem(blockNum, txid, OutputBytecode, MetaData['Tokens'], MetaData['BaseCurrency']).translate();
            if (await DBHelper.getCount(db.FundRedeem, { txid }) > 0) {
              await DBHelper.updateFundRedeemByQuery(db.FundRedeem, { txid }, fund);
            } else {
              console.log(fund);
              await DBHelper.insertTopic(db.FundRedeem, fund)
            }
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
      const topics = rawLog.topics.map(i => '0x' + i );
      const data = '0x' + rawLog.data;
      const OutputBytecode = abi.decodeEvent(MetaData['Exchange']['Abi'][15],
      data,
      topics);
      console.log('OutputBytecode');
      console.log(OutputBytecode);
      if (OutputBytecode._eventName === 'Withdrawal') {
        const redeemDB = new Promise(async (resolve) => {
          try {
            const redeem = new FundRedeem(blockNum, txid, OutputBytecode, MetaData['Tokens'], MetaData['BaseCurrency']).translate();
            if (await DBHelper.getCount(db.FundRedeem, { txid }) > 0) {
              await DBHelper.updateFundRedeemByQuery(db.FundRedeem, { txid }, redeem);
            } else {
              console.log(redeem);
              await DBHelper.insertTopic(db.FundRedeem, redeem)
            }
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

async function syncMarketMaker(db, startBlock, endBlock, removeHexPrefix) {
  let result;
  try {
    result = await getInstance().searchLogs(
      startBlock, endBlock, MetaData['Exchange']['Address'],
      [MetaData['Exchange']['Trade']], MetaData, removeHexPrefix,
    );
    getLogger().debug('searchlog syncMarketMaker');
  } catch (err) {
    getLogger().error(`ERROR: ${err.message}`);
    return;
  }

  getLogger().debug(`${startBlock} - ${endBlock}: Retrieved ${result.length} entries from syncMarketMaker`);
  const createMarketMakerPromises = [];

  _.forEach(result, (event, index) => {
    const blockNum = event.blockNumber;
    const txid = event.transactionHash;
    _.forEachRight(event.log, (rawLog) => {
      if (rawLog._eventName === 'MarketMaker') {
        const removeNewOrderDB = new Promise(async (resolve) => {
          try {
            const marketMaker = new MarketMaker(blockNum, txid, rawLog).translate();
            //console.log(marketMaker);
            //await DBHelper.removeOrdersByQuery(db.NewOrder, { orderId: cancelOrder.orderId });
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