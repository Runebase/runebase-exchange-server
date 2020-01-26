/* eslint no-underscore-dangle: 0 */

const _ = require('lodash');
const { Decoder } = require('rweb3');
const { isMainnet } = require('../config');

class Trade {
  constructor(blockNum, txid, rawLog, getOrder) {
    if (!_.isEmpty(rawLog)) {
      this.blockNum = blockNum;
      this.txid = txid;
      this.rawLog = rawLog;
      this.getOrder = getOrder;
      this.token = 'Unregistered';
      this.tokenName = 'Unregistered Token';
      this.decimals = 0;
      this.decode();
    }
  }

  decode() {
    this.orderId = this.rawLog._orderId.toString(10);
    this.time = Number(this.rawLog._time.toString(10));
    this.from = this.rawLog._from.toString().substring(2);
    this.to = this.rawLog._to.toString().substring(2);
    this.soldTokens = this.rawLog._soldTokens.toString(10);
    this.boughtTokens = this.rawLog._boughtTokens.toString(10);
    this.price = this.getOrder.price;
    this.orderType = this.getOrder.orderType;
    this.tokenName = this.getOrder.tokenName;
    this.token = this.getOrder.token;
    if (this.orderType === 'SELLORDER') {
      this.amount = this.soldTokens;
    }
    if (this.orderType === 'BUYORDER') {
      this.amount = this.boughtTokens;
    }
    this.tokenAddress = this.getOrder.tokenAddress;
    this.decimals = this.getOrder.decimals;
  }

  translate() {
    return {
      type: this.orderType,
      txid: this.txid,
      status: 'CONFIRMED',
      orderId: this.orderId,
      time: this.time,
      from: Decoder.toRunebaseAddress(this.from, isMainnet()),
      to: Decoder.toRunebaseAddress(this.to, isMainnet()),
      soldTokens: this.soldTokens,
      boughtTokens: this.boughtTokens,
      price: this.price,
      orderType: this.orderType,
      tokenName: this.tokenName,
      token: this.token,
      tokenAddress: this.tokenAddress,
      amount: this.amount,
      blockNum: this.blockNum,
      decimals: this.decimals,
    };
  }
}

module.exports = Trade;
