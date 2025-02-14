const _ = require('lodash');

const { getLogger } = require('../utils/logger');

class DBHelper {
  static async getCount(database, query) {
    try {
      return await database.count(query);
    } catch (err) {
      getLogger().error(`Error getting DB count. db:${database} err:${err.message}`);
    }
  }

  /*
  * Returns the fields of the object in one of the tables searched by the query.
  * @param database {Object} The DB table.
  * @param query {Object} The query by items.
  * @param fields {Array} The fields to return for the found item in an array.
  */
  static async findOne(database, query, fields) {
    let fieldsObj;
    if (!_.isEmpty(fields)) {
      fieldsObj = {};
      _.each(fields, (field) => {
        fieldsObj[field] = 1;
      });
    }

    const found = await database.findOne(query, fieldsObj);
    if (!found) {
      const { filename } = database.nedb;
      throw Error(`findOne ${filename.substr(filename.lastIndexOf('/') + 1)} by query ${JSON.stringify(query)}`);
    }
    return found;
  }

  static async insertTopic(database, topic) {
    try {
      await database.insert(topic);
    } catch (err) {
      getLogger().error(`Error insert Topic ${topic}: ${err.message}`);
    }
  }

  static async updateObjectByQuery(database, query, update) {
    try {
      await database.update(query, { $set: update }, {});
    } catch (err) {
      getLogger().error(`Error update ${update} object by query:${query}: ${err.message}`);
    }
  }


  static async updateTopicByQuery(database, query, topic) {
    try {
      await database.update(
        query,
        {
          $set: {
            txid: topic.txid,
            blockNum: topic.blockNum,
            status: topic.status,
            version: topic.version,
            address: topic.address,
            name: topic.name,
            options: topic.options,
            runebaseAmount: topic.runebaseAmount,
            predAmount: topic.predAmount,
            resultIdx: topic.resultIdx,
            creatorAddress: topic.creatorAddress,
          },
        },
        {},
      );
    } catch (err) {
      getLogger().error(`Error update Topic by query:${query}: ${err.message}`);
    }
  }

  static async removeTopicsByQuery(topicDb, query) {
    try {
      const numRemoved = await topicDb.remove(query, { multi: true });
      getLogger().debug(`Remove: ${numRemoved} Topic query:${query}`);
    } catch (err) {
      getLogger().error(`Remove Topics by query:${query}: ${err.message}`);
    }
  }

  static async insertOracle(database, oracle) {
    try {
      await database.insert(oracle);
    } catch (err) {
      getLogger().error(`Error insert COracle:${oracle}: ${err.message}`);
    }
  }

  static async updateOracleByQuery(database, query, oracle) {
    try {
      await database.update(
        query,
        {
          $set: {
            txid: oracle.txid,
            blockNum: oracle.blockNum,
            status: oracle.status,
            version: oracle.version,
            address: oracle.address,
            topicAddress: oracle.topicAddress,
            resultSetterAddress: oracle.resultSetterAddress,
            token: oracle.token,
            name: oracle.name,
            options: oracle.options,
            optionIdxs: oracle.optionIdxs,
            amounts: oracle.amounts,
            resultIdx: oracle.resultIdx,
            startTime: oracle.startTime,
            endTime: oracle.endTime,
            resultSetStartTime: oracle.resultSetStartTime,
            resultSetEndTime: oracle.resultSetEndTime,
            consensusThreshold: oracle.consensusThreshold,
            hashId: oracle.hashId,
          },
        },
        {},
      );
    } catch (err) {
      getLogger().error(`Error update Oracle by query:${query}: ${err.message}`);
    }
  }

  static async removeOraclesByQuery(oracleDb, query) {
    try {
      const numRemoved = await oracleDb.remove(query, { multi: true });
      getLogger().debug(`Remove: ${numRemoved} Oracle by query:${query}`);
    } catch (err) {
      getLogger().error(`Remove Oracles by query:${query}: ${err.message}`);
    }
  }

  static async insertTransaction(database, tx) {
    try {
      getLogger().debug(`Mutation Insert: Transaction ${tx.type} txid:${tx.txid}`);
      await database.insert(tx);
    } catch (err) {
      getLogger().error(`Error inserting Transaction ${tx.type} ${tx.txid}: ${err.message}`);
      throw err;
    }
  }

  static async isPreviousCreateEventPending(txDb, senderAddress) {
    try {
      return await txDb.count({
        type: { $in: ['APPROVECREATEEVENT', 'CREATEEVENT'] },
        status: 'PENDING',
        senderAddress,
      });
    } catch (err) {
      getLogger().error(`Checking CreateEvent pending: ${err.message}`);
      throw err;
    }
  }
}

module.exports = DBHelper;
