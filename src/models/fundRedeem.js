/* eslint no-underscore-dangle: 0 */

const _ = require('lodash');
const { Decoder } = require('rweb3');
const BigNumber = require('bignumber.js');
const { isMainnet, getContractMetadata } = require('../config');
const { orderState, SATOSHI_CONVERSION } = require('../constants');

class NewOrder {
  constructor(blockNum, txid, rawLog) {
    if (!_.isEmpty(rawLog)) {
      this.blockNum = blockNum;
      this.txid = txid;
      this.rawLog = rawLog;
      this.decode();
    }
  }

  decode() {
    this.amount =  new BigNumber(this.rawLog._amount).dividedBy(SATOSHI_CONVERSION).toString(10);
    this.time = this.rawLog._time.toString(10);
    this.date = new Date(this.rawLog._time.toString(10)*1000);
    const metadata = getContractMetadata();
    if (this.rawLog._token === metadata['BaseCurrency']['address']) {
      this.tokenName = metadata['BaseCurrency']['pair'];
    }
    for (var key in metadata['Tokens']){
      if (metadata['Tokens'][key]['address'] === this.rawLog._token) {
        this.tokenName = metadata['Tokens'][key]["pair"];
      }
    }
    this.token = this.rawLog._token;
    this.owner = this.rawLog._owner;
    if (this.rawLog._eventName == 'Deposit') {
      this.type = 'DEPOSITEXCHANGE';
    }
    if (this.rawLog._eventName == 'Withdrawal') {
      this.type = 'WITHDRAWEXCHANGE';
    }

  }
  translate() {
    return {
      txid: this.txid,
      type: this.type,
      token: this.token,
      tokenName: this.tokenName,
      status: 'CONFIRMED',
      owner: Decoder.toRunebaseAddress(this.owner, isMainnet()),
      time: this.time,
      date: this.date,
      amount: this.amount,
      blockNum: this.blockNum,
    };
  }
}

module.exports = NewOrder;

