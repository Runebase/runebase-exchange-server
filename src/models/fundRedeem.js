/* eslint no-underscore-dangle: 0 */

const _ = require('lodash');
const { Decoder } = require('rweb3');
const BigNumber = require('bignumber.js');
const { isMainnet } = require('../config');
const { SATOSHI_CONVERSION } = require('../constants');

class NewOrder {
  constructor(blockNum, txid, rawLog, tokens, baseCurrency) {
    if (!_.isEmpty(rawLog)) {
      this.blockNum = blockNum;
      this.txid = txid;
      this.rawLog = rawLog;
      this.tokens = tokens;
      this.baseCurrency = baseCurrency;
      this.token = 'Unregistered';
      this.tokenName = 'Unregistered Token';
      this.decode();
    }
  }

  decode() {
    this.tokenAddress = this.rawLog._token.substring(2);
    this.owner = this.rawLog._owner.substring(2);
    this.time = this.rawLog._time.toString(10);
    if (this.tokenAddress === this.baseCurrency.Address) {
      console.log('DEPOSIT/WITHDRAW RUNES');
      this.token = this.baseCurrency.Pair;
      this.tokenName = this.baseCurrency.Name;
      this.amount = new BigNumber(this.rawLog._amount).dividedBy(10 ** 8).toString(10);
    }
    Object.keys(this.tokens).forEach((key) => {
      if (this.tokens[key].address === this.tokenAddress) {
        console.log(`DEPOSIT/WITHDRAW ${this.tokens[key].market}`);
        this.token = this.tokens[key].market;
        this.tokenName = this.tokens[key].tokenName;
        this.amount = new BigNumber(this.rawLog._amount).dividedBy(10 ** this.tokens[key].decimals).toString(10);
      }
    });
    if (this.rawLog._eventName === 'Deposit') {
      this.type = 'DEPOSITEXCHANGE';
    }
    if (this.rawLog._eventName === 'Withdrawal') {
      this.type = 'WITHDRAWEXCHANGE';
    }
  }

  translate() {
    return {
      txid: this.txid,
      type: this.type,
      token: this.token,
      tokenAddress: this.tokenAddress,
      tokenName: this.tokenName,
      status: 'CONFIRMED',
      owner: Decoder.toRunebaseAddress(this.owner, isMainnet()),
      time: this.time,
      amount: this.amount,
      blockNum: this.blockNum,
    };
  }
}

module.exports = NewOrder;
