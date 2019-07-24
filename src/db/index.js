const datastore = require('nedb-promise');
const _ = require('lodash');
const fs = require('fs-extra');

const Utils = require('../utils');
const { getLogger } = require('../utils/logger');
const migrateTxDB = require('./migrations/migrateTx');
const Market = require('../models/market');
const { getContractMetadata } = require('../config');

const db = {
  Blocks: undefined,
  Transactions: undefined,
  NewOrder: undefined,
  Trade: undefined,
  MarketMaker: undefined,
  OrderFulfilled: undefined,
  Markets: undefined,
  FundRedeem: undefined,
};


// Init datastores
async function initDB() {
  try {
    await migrateDB();
  } catch (err) {
    throw new Error(`DB Migration Error: ${err.message}`);
  }

  const blockchainDataPath = Utils.getDataDir();
  getLogger().info(`Blockchain data path: ${blockchainDataPath}`);

  const localCacheDataPath = Utils.getLocalCacheDataDir();
  getLogger().info(`Local cache data path: ${localCacheDataPath}`);

  db.Blocks = datastore({ filename: `${blockchainDataPath}/blocks.db` });
  db.Transactions = datastore({ filename: `${localCacheDataPath}/transactions.db` });
  db.NewOrder = datastore({ filename: `${blockchainDataPath}/neworder.db` });
  db.Trade = datastore({ filename: `${blockchainDataPath}/trade.db` });
  db.MarketMaker = datastore({ filename: `${blockchainDataPath}/marketMaker.db` });
  db.OrderFulfilled = datastore({ filename: `${blockchainDataPath}/orderfulfilled.db` });
  db.Markets = datastore({ filename: `${blockchainDataPath}/markets.db` });
  db.FundRedeem = datastore({ filename: `${blockchainDataPath}/fundRedeem.db` });

  try {
    await Promise.all([
      db.Blocks.loadDatabase(),
      db.Transactions.loadDatabase(),
      db.NewOrder.loadDatabase(),
      db.Trade.loadDatabase(),
      db.MarketMaker.loadDatabase(),
      db.OrderFulfilled.loadDatabase(),
      db.Markets.loadDatabase(),
      db.FundRedeem.loadDatabase(),
    ]);


    const MetaData = await getContractMetadata();

    for (MarketName in MetaData['Tokens']){
      const addMarket = MetaData['Tokens'][MarketName]['Pair'];
      const dataSrc = blockchainDataPath + '/' + addMarket + '.tsv';
      if (!fs.existsSync(dataSrc)){
        fs.writeFile(dataSrc, 'date\topen\thigh\tlow\tclose\tvolume\n2018-01-01\t0\t0\t0\t0\t0\n2018-01-02\t0\t0\t0\t0\t0\n', { flag: 'w' }, function(err) {
          if (err)
            return console.error(err);
        });
      }
      fs.closeSync(fs.openSync(dataSrc, 'a'));
      db.Markets.count({ market: addMarket }, function (err, count) {
        if (count === 0) {
          const market = new Market(addMarket, MetaData['Tokens'][MarketName]).translate();
          console.log(market);
          db.Markets.insert(market);
        }
      });
    }
  } catch (err) {
    throw Error(`DB load Error: ${err.message}`);
  }
}

// Delete blockchain RunebaseExchange data
function deleteRunebaseExchangeData() {
  const logger = getLogger();
  const blockchainDataPath = Utils.getDataDir();

  try {
    fs.removeSync(`${blockchainDataPath}/PRED.tsv`);
  } catch (err) {
    logger.error(`Delete PRED.tsv error: ${err.message}`);
  }

  try {
    fs.removeSync(`${blockchainDataPath}/FUN.tsv`);
  } catch (err) {
    logger.error(`Delete FUN.tsv error: ${err.message}`);
  }

  try {
    fs.removeSync(`${blockchainDataPath}/fundRedeem.db`);
  } catch (err) {
    logger.error(`Delete fundRedeem.db error: ${err.message}`);
  }

  try {
    fs.removeSync(`${blockchainDataPath}/markets.db`);
  } catch (err) {
    logger.error(`Delete markets.db error: ${err.message}`);
  }

  try {
    fs.removeSync(`${blockchainDataPath}/orderfulfilled.db`);
  } catch (err) {
    logger.error(`Delete orderfulfilled.db error: ${err.message}`);
  }

  try {
    fs.removeSync(`${blockchainDataPath}/marketMaker.db`);
  } catch (err) {
    logger.error(`Delete marketMaker.db error: ${err.message}`);
  }

  try {
    fs.removeSync(`${blockchainDataPath}/trade.db`);
  } catch (err) {
    logger.error(`Delete trade.db error: ${err.message}`);
  }

  try {
    fs.removeSync(`${blockchainDataPath}/neworder.db`);
  } catch (err) {
    logger.error(`Delete neworder.db error: ${err.message}`);
  }

  try {
    fs.removeSync(`${blockchainDataPath}/blocks.db`);
  } catch (err) {
    logger.error(`Delete blocks.db error: ${err.message}`);
  }

  logger.info('RunebaseExchange data deleted.');
}

// Migrate DB
async function migrateDB() {
  // check migration script in migration folder
  await migrateTxDB();
}

class DBHelper {
  static async getCount(db, query) {
    try {
      return await db.count(query);
    } catch (err) {
      getLogger().error(`Error getting DB count. db:${db} err:${err.message}`);
    }
  }

  static async insertTopic(db, topic) {
    try {
      await db.insert(topic);
    } catch (err) {
      getLogger().error(`Error insert Topic ${topic}: ${err.message}`);
    }
  }

  /*
  *removeOrdersByQuery
  *
  */
  static async removeOrdersByQuery(orderDb, query) {
    try {
      const numRemoved = await orderDb.remove(query, { multi: true });
      getLogger().debug(`Remove: ${numRemoved} Orders query:${query}`);
    } catch (err) {
      getLogger().error(`Remove Orders by query:${query}: ${err.message}`);
    }
  }

  /*
  * Update FundRedeem
  *
  */
  static async updateFundRedeemByQuery(db, query, topic) {
    try {
      await db.update(
        query,
        {
          $set: {
            txid: topic.txid,
            type: topic.type,
            token: topic.token,
            tokenName: topic.tokenName,
            status: topic.status,
            owner: topic.owner,
            time: topic.time,
            date: topic.date,
            amount: topic.amount,
            blockNum: topic.blockNum,
          },
        },
        {},
      );
    } catch (err) {
      getLogger().error(`Error update Topic by query:${query}: ${err.message}`);
    }
  }

  /*
  * Update Trade
  *
  */
  static async updateTradeByQuery(db, query, topic) {
    try {
      await db.update(
        query,
        {
          $set: {
            date: topic.date,
            txid: topic.txid,
            status: topic.status,
            orderId: topic.orderId,
            time: topic.time,
            from: topic.from,
            to: topic.to,
            soldTokens: topic.soldTokens,
            boughtTokens: topic.boughtTokens,
            price: topic.price,
            orderType: topic.orderType,
            tokenName: topic.tokenName,
            amount: topic.amount,
            blockNum: topic.blockNum,
          },
        },
        {},
      );
    } catch (err) {
      getLogger().error(`Error update Topic by query:${query}: ${err.message}`);
    }
  }

  /*
  * Update Markets
  *
  */
  static async updateMarketsByQuery(db, query, topic) {
    try {
      await db.update(
        query,
        {
          $set: {
            tokenName: topic.tokenName,
            change: topic.change,
            volume: topic.volume,
            price: topic.price,
            market: topic.market,
          },
        },
        {},
      );
    } catch (err) {
      getLogger().error(`Error update Topic by query:${query}: ${err.message}`);
    }
  }

  /*
  * Canceled orders
  *
  */
  static async updateCanceledOrdersByQuery(db, query, topic) {
    try {
      await db.update(
        query,
        {
          $set: {
            orderId: topic.orderId,
            status: topic.status,
            timeCanceled: topic.timeCanceled,
            txCanceled: topic.txCanceled,
          },
        },
        {},
      );
    } catch (err) {
      getLogger().error(`Error update Topic by query:${query}: ${err.message}`);
    }
  }

  /*
  * FulFill orders
  *
  */
  static async updateFulfilledOrdersByQuery(db, query, topic) {
    try {
      await db.update(
        query,
        {
          $set: {
            orderId: topic.orderId,
            status: topic.status,
            timeFulfilled: topic.timeFulfilled,
            txFulfilled: topic.txFulfilled,
          },
        },
        {},
      );
    } catch (err) {
      getLogger().error(`Error update Topic by query:${query}: ${err.message}`);
    }
  }

  /*
  * Update Order
  *
  */
  static async updateOrderByQuery(db, query, topic) {
    try {
      await db.update(
        query,
        {
          $set: {
            txid: topic.txid,
            orderId: topic.orderId,
            blockNum: topic.blockNum,
            token: topic.token,
            price: topic.price,
            type: topic.type,
            status: topic.status,
            resultIdx: topic.resultIdx,
            creatorAddress: topic.creatorAddress,
            owner: topic.owner,
            sellToken: topic.sellToken,
            buyToken: topic.buyToken,
            priceMul: topic.priceMul,
            priceDiv: topic.priceDiv,
            time: topic.time,
            amount: topic.amount,
            startAmount: topic.startAmount,
          },
        },
        {},
      );
    } catch (err) {
      getLogger().error(`Error update Topic by query:${query}: ${err.message}`);
    }
  }

  /*
  * Update TradeOrder
  *
  */
  static async updateTradeOrderByQuery(db, query, topic) {
    try {
      await db.update(
        query,
        {
          $set: {
            amount: topic.amount,
          },
        },
        {},
      );
    } catch (err) {
      getLogger().error(`Error update Topic by query:${query}: ${err.message}`);
    }
  }

  static async cancelOrderByQuery(db, query, topic) {
    try {
      await db.update(
        query,
        {
          $set: {
            orderId: topic.orderId,
            status: topic.status,
            timeCanceled: topic.timeCanceled,
            txCanceled: topic.txCanceled,
          },
        },
        {},
      );
    } catch (err) {
      getLogger().error(`Error update Topic by query:${query}: ${err.message}`);
    }
  }

 /*
  * Returns the fields of the object in one of the tables searched by the query.
  * @param db The DB table.
  * @param query {Object} The query by items.
  * @param fields {Array} The fields to return for the found item in an array.
  */
  static async findTradeAndUpdate(db, query, fields, soldTokens, orderId) {
    let fieldsObj;
    if (!_.isEmpty(fields)) {
      fieldsObj = {};
      _.each(fields, field => fieldsObj[field] = 1);
    }

    const found = await db.findOne(query, fieldsObj);
    if (!found) {
      const { filename } = db.nedb;
      throw Error(`Could not findOne ${filename.substr(filename.lastIndexOf('/') + 1)} by query ${JSON.stringify(query)}`);
    }
    const newAmount = Number(found.amount) - Number(soldTokens);
    const updateOrder = {
      amount: newAmount,
    }
    await DBHelper.updateTradeOrderByQuery(db, { orderId }, updateOrder);
    return found;
  }


  /*
  * Returns the fields of the object in one of the tables searched by the query.
  * @param db The DB table.
  * @param query {Object} The query by items.
  * @param fields {Array} The fields to return for the found item in an array.
  */
  static async findOne(db, query, fields) {
    let fieldsObj;
    if (!_.isEmpty(fields)) {
      fieldsObj = {};
      _.each(fields, field => fieldsObj[field] = 1);
    }

    const found = await db.findOne(query, fieldsObj);
    if (!found) {
      const { filename } = db.nedb;
      throw Error(`Could not findOne ${filename.substr(filename.lastIndexOf('/') + 1)} by query ${JSON.stringify(query)}`);
    }
    return found;
  }

    /*
  * Returns the fields of the object in one of the tables searched by the query.
  * @param db The DB table.
  * @param query {Object} The query by items.
  * @param fields {Array} The fields to return for the found item in an array.
  */
  static async find(db, query, fields) {
    let fieldsObj;
    if (!_.isEmpty(fields)) {
      fieldsObj = {};
      _.each(fields, field => fieldsObj[field] = 1);
    }

    const found = await db.find(query, fieldsObj);
    if (!found) {
      const { filename } = db.nedb;
      throw Error(`Could not find ${filename.substr(filename.lastIndexOf('/') + 1)} by query ${JSON.stringify(query)}`);
    }
    return found;
  }

  static async updateObjectByQuery(db, query, update) {
    try {
      await db.update(query, { $set: update }, {});
    } catch (err) {
      getLogger().error(`Error update ${update} object by query:${query}: ${err.message}`);
    }
  }

  static async insertTransaction(db, tx) {
    try {
      getLogger().debug(`Mutation Insert: Transaction ${tx.type} txid:${tx.txid}`);
      await db.insert(tx);
    } catch (err) {
      getLogger().error(`Error inserting Transaction ${tx.type} ${tx.txid}: ${err.message}`);
      throw err;
    }
  }
}

module.exports = {
  db,
  initDB,
  deleteRunebaseExchangeData,
  DBHelper,
};
