const _ = require('lodash');
const moment = require('moment');

const { getLogger } = require('../utils/logger');
const blockchain = require('../api/blockchain');
const wallet = require('../api/wallet');
const { DBHelper } = require('../db');
const { Config, getContractMetadata } = require('../config');
const { txState, orderState } = require('../constants');
const Utils = require('../utils');

/* UPDATE FAILED ORDERS */
// Fetch pending Orders
async function updatePendingOrders(db, currentBlockCount) {
  let pendingOrders;
  try {
    pendingOrders = await db.NewOrder.cfind({ status: orderState.PENDING })
      .sort({ createdTime: -1 }).exec();
  } catch (err) {
    getLogger().error(`Error: get pending Orders: ${err.message}`);
    throw err;
  }

  // TODO(frank): batch to void too many rpc calls
  const updatePromises = [];
  _.each(pendingOrders, (order) => {
    updatePromises.push(new Promise(async (resolve) => {
      await updateOrder(order, currentBlockCount);
      await updateOrderDB(order, db);
      resolve();
    }));
  });
  await Promise.all(updatePromises);
}

// Update the Order info
async function updateOrder(order, currentBlockCount) {
  // sendtoaddress does not use the same confirmation method as EVM txs
  if (order.token === 'RUNES' && !order.blockNum) {
    const orderInfo = await wallet.getTransaction({ txid: order.txid });

    if (orderInfo.confirmations > 0) {
      order.status = orderState.CONFIRMED;
      order.gasUsed = Math.floor(Math.abs(orderInfo.fee) / Config.DEFAULT_GAS_PRICE);

      order.blockNum = (currentBlockCount - orderInfo.confirmations) + 1;
      const blockHash = await blockchain.getBlockHash({ blockNum: order.blockNum });
      const blockInfo = await blockchain.getBlock({ blockHash });
      order.blockTime = blockInfo.time;
    }
    return;
  }

  // Update order status based on EVM order logs
  const resp = await blockchain.getTransactionReceipt({ transactionId: order.txid });

  if (_.isEmpty(resp)) {
    order.status = orderState.PENDING;
  } else {
    const blockInfo = await blockchain.getBlock({ blockHash: resp[0].blockHash });

    order.status = _.isEmpty(resp[0].log) ? orderState.FAIL : orderState.CONFIRMED;
    order.gasUsed = resp[0].gasUsed;
    order.blockNum = resp[0].blockNumber;
    order.blockTime = blockInfo.time;
  }
}

// Update the DB with new Order info
async function updateOrderDB(order, db) {
  if (order.status !== txState.PENDING) {
    try {
      getLogger().debug(`Update: ${order.status} Transaction ${order.type} txid:${order.txid}`);
      const updateRes = await db.NewOrder.update(
        { txid: order.txid },
        {
          $set: {
            status: order.status,
            gasUsed: order.gasUsed,
            blockNum: order.blockNum,
          },
        },
        {
          returnUpdatedDocs: true,
        },
      );
    } catch (err) {
      getLogger().error(`Error: Update Transaction ${order.type} txid:${order.txid}: ${err.message}`);
      throw err;
    }
  }
}

/* UPDATE FAILED FUNDREDEEMS */
// Fetch pending FundRedeems
async function updatePendingFundRedeems(db, currentBlockCount) {
  let pendingFundRedeems;
  try {
    pendingFundRedeems = await db.FundRedeem.cfind({ status: orderState.PENDING })
      .sort({ createdTime: -1 }).exec();
  } catch (err) {
    getLogger().error(`Error: get pending FundRedeems: ${err.message}`);
    throw err;
  }

  // TODO(frank): batch to void too many rpc calls
  const updatePromises = [];
  _.each(pendingFundRedeems, (fundRedeem) => {
    updatePromises.push(new Promise(async (resolve) => {
      await updateFundRedeem(fundRedeem, currentBlockCount);
      await updateFundRedeemDB(fundRedeem, db);
      resolve();
    }));
  });
  await Promise.all(updatePromises);
}

// Update the Order info
async function updateFundRedeem(fundRedeem, currentBlockCount) {
  // sendtoaddress does not use the same confirmation method as EVM txs
  if (fundRedeem.token === 'RUNES' && !fundRedeem.blockNum) {
    const fundRedeemInfo = await wallet.getTransaction({ txid: fundRedeem.txid });

    if (fundRedeemInfo.confirmations > 0) {
      fundRedeem.status = txState.SUCCESS;
      fundRedeem.gasUsed = Math.floor(Math.abs(fundRedeemInfo.fee) / Config.DEFAULT_GAS_PRICE);

      fundRedeem.blockNum = (currentBlockCount - fundRedeemInfo.confirmations) + 1;
      const blockHash = await blockchain.getBlockHash({ blockNum: fundRedeem.blockNum });
      const blockInfo = await blockchain.getBlock({ blockHash });
      fundRedeem.blockTime = blockInfo.time;
    }
    return;
  }

  // Update order status based on EVM order logs
  const resp = await blockchain.getTransactionReceipt({ transactionId: fundRedeem.txid });

  if (_.isEmpty(resp)) {
    fundRedeem.status = orderState.PENDING;
  } else {
    const blockInfo = await blockchain.getBlock({ blockHash: resp[0].blockHash });

    fundRedeem.status = _.isEmpty(resp[0].log) ? orderState.FAIL : orderState.CONFIRMED;
    fundRedeem.gasUsed = resp[0].gasUsed;
    fundRedeem.blockNum = resp[0].blockNumber;
    fundRedeem.blockTime = blockInfo.time;
  }
}

// Update the DB with new Order info
async function updateFundRedeemDB(fundRedeem, db) {
  if (fundRedeem.status !== txState.PENDING) {
    try {
      getLogger().debug(`Update: ${fundRedeem.status} Transaction ${fundRedeem.type} txid:${fundRedeem.txid}`);
      const updateRes = await db.FundRedeem.update(
        { txid: fundRedeem.txid },
        {
          $set: {
            status: fundRedeem.status,
            gasUsed: fundRedeem.gasUsed,
            blockNum: fundRedeem.blockNum,
          },
        },
        {
          returnUpdatedDocs: true,
        },
      );
    } catch (err) {
      getLogger().error(`Error: Update Transaction ${fundRedeem.type} txid:${fundRedeem.txid}: ${err.message}`);
      throw err;
    }
  }
}

/* UPDATE FAILED Trades */
// Fetch pending Trades
async function updatePendingTrades(db, currentBlockCount) {
  let pendingTrades;
  try {
    pendingTrades = await db.Trade.cfind({ status: orderState.PENDING })
      .sort({ createdTime: -1 }).exec();
  } catch (err) {
    getLogger().error(`Error: get pending Trades: ${err.message}`);
    throw err;
  }

  const updatePromises = [];
  _.each(pendingTrades, (trade) => {
    updatePromises.push(new Promise(async (resolve) => {
      await updateTrade(trade, currentBlockCount);
      await updateTradeDB(trade, db);
      resolve();
    }));
  });
  await Promise.all(updatePromises);
}

// Update the Order info
async function updateTrade(trade, currentBlockCount) {
  // sendtoaddress does not use the same confirmation method as EVM txs
  if (trade.token === 'RUNES' && !trade.blockNum) {
    const tradeInfo = await wallet.getTransaction({ txid: trade.txid });

    if (tradeInfo.confirmations > 0) {
      trade.status = orderState.CONFIRMED;
      trade.gasUsed = Math.floor(Math.abs(tradeInfo.fee) / Config.DEFAULT_GAS_PRICE);

      trade.blockNum = (currentBlockCount - tradeInfo.confirmations) + 1;
      const blockHash = await blockchain.getBlockHash({ blockNum: trade.blockNum });
      const blockInfo = await blockchain.getBlock({ blockHash });
      trade.blockTime = blockInfo.time;
    }
    return;
  }

  // Update order status based on EVM order logs
  const resp = await blockchain.getTransactionReceipt({ transactionId: trade.txid });

  if (_.isEmpty(resp)) {
    trade.status = orderState.PENDING;
  } else {
    const blockInfo = await blockchain.getBlock({ blockHash: resp[0].blockHash });

    trade.status = _.isEmpty(resp[0].log) ? orderState.FAIL : orderState.CONFIRMED;
    trade.gasUsed = resp[0].gasUsed;
    trade.blockNum = resp[0].blockNumber;
    trade.blockTime = blockInfo.time;
  }
}

// Update the DB with new Order info
async function updateTradeDB(trade, db) {
  if (trade.status !== txState.PENDING) {
    try {
      getLogger().debug(`Update: ${trade.status} Transaction ${trade.type} txid:${trade.txid}`);
      const updateRes = await db.Trade.update(
        { txid: trade.txid },
        {
          $set: {
            status: trade.status,
            gasUsed: trade.gasUsed,
            blockNum: trade.blockNum,
          },
        },
        {
          returnUpdatedDocs: true,
        },
      );
    } catch (err) {
      getLogger().error(`Error: Update Transaction ${trade.type} txid:${trade.txid}: ${err.message}`);
      throw err;
    }
  }
}

/* Prediction Market & Wallet TXs */
// Fetch Pending TXs
async function updatePendingTxs(db, currentBlockCount) {
  let pendingTxs;
  try {
    pendingTxs = await db.Transactions.cfind({ status: txState.PENDING })
      .sort({ createdTime: -1 }).exec();
  } catch (err) {
    getLogger().error(`Error: get pending Transactions: ${err.message}`);
    throw err;
  }

  // TODO(frank): batch to void too many rpc calls
  const updatePromises = [];
  _.each(pendingTxs, (tx) => {
    updatePromises.push(new Promise(async (resolve) => {
      await updateTx(tx, currentBlockCount);
      await updateDB(tx, db);
      resolve();
    }));
  });
  await Promise.all(updatePromises);
}

// Update the Transaction info
async function updateTx(tx, currentBlockCount) {
  // sendtoaddress does not use the same confirmation method as EVM txs
  if (tx.type === 'TRANSFER' && tx.token === 'RUNES' && !tx.blockNum) {
    const txInfo = await wallet.getTransaction({ txid: tx.txid });

    if (txInfo.confirmations > 0) {
      tx.status = txState.SUCCESS;
      tx.gasUsed = Math.floor(Math.abs(txInfo.fee) / Config.DEFAULT_GAS_PRICE);

      tx.blockNum = (currentBlockCount - txInfo.confirmations) + 1;
      const blockHash = await blockchain.getBlockHash({ blockNum: tx.blockNum });
      const blockInfo = await blockchain.getBlock({ blockHash });
      tx.blockTime = blockInfo.time;
    }
    return;
  }

  // Update tx status based on EVM tx logs
  const resp = await blockchain.getTransactionReceipt({ transactionId: tx.txid });

  if (_.isEmpty(resp)) {
    tx.status = txState.PENDING;
  } else {
    const blockInfo = await blockchain.getBlock({ blockHash: resp[0].blockHash });

    tx.status = _.isEmpty(resp[0].log) ? txState.FAIL : txState.SUCCESS;
    tx.gasUsed = resp[0].gasUsed;
    tx.blockNum = resp[0].blockNumber;
    tx.blockTime = blockInfo.time;
  }
}

// Update the DB with new Transaction info
async function updateDB(tx, db) {
  if (tx.status !== txState.PENDING) {
    try {
      getLogger().debug(`Update: ${tx.status} Transaction ${tx.type} txid:${tx.txid}`);
      const updateRes = await db.Transactions.update(
        { txid: tx.txid },
        {
          $set: {
            status: tx.status,
            gasUsed: tx.gasUsed,
            blockNum: tx.blockNum,
          },
        },
        {
          returnUpdatedDocs: true,
        },
      );
      const updatedTx = updateRes[1];

      // Execute follow up tx
      if (updatedTx) {
        switch (updatedTx.status) {
          case txState.SUCCESS: {
            await onSuccessfulTx(updatedTx, db);
            break;
          }
          case txState.FAIL: {
            await onFailedTx(updatedTx, db);
            break;
          }
          default: {
            break;
          }
        }
      }
    } catch (err) {
      getLogger().error(`Error: Update Transaction ${tx.type} txid:${tx.txid}: ${err.message}`);
      throw err;
    }
  }
}


module.exports = {
  updatePendingTxs: updatePendingTxs,
  updatePendingOrders: updatePendingOrders,
  updatePendingFundRedeems: updatePendingFundRedeems,
  updatePendingTrades: updatePendingTrades,
};
