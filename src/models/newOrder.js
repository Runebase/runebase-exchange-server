/* eslint no-underscore-dangle: 0 */

const _ = require('lodash');
const { Decoder } = require('rweb3');
const math = require('mathjs');
const stripHexPrefix = require('strip-hex-prefix');
const { isMainnet } = require('../config');
const { orderState } = require('../constants');

class NewOrder {
  constructor(blockNum, txid, rawLog, tokens, baseCurrencyAddress) {
    if (!_.isEmpty(rawLog)) {
      this.blockNum = blockNum;
      this.txid = txid;
      this.rawLog = rawLog;
      this.sellToken = rawLog._sellToken.substring(2);
      this.buyToken = rawLog._buyToken.substring(2);
      this.tokens = tokens;
      this.baseCurrencyAddress = baseCurrencyAddress;
      this.token = 'Unregistered';
      this.tokenName = 'Unregistered Token';
      this.decimals = 0;
      this.decode();
    }
  }

  decode() {
    if (this.rawLog._sellToken.toString(10) === '0x0000000000000000000000000000000000000000') {
      this.tokenAddress = stripHexPrefix(this.rawLog._buyToken.toString(10));
    }
    if (this.rawLog._buyToken.toString(10) === '0x0000000000000000000000000000000000000000') {
      this.tokenAddress = stripHexPrefix(this.rawLog._sellToken.toString(10));
    }
    Object.keys(this.tokens).forEach((key) => {
      if (this.tokens[key].address === this.sellToken || this.tokens[key].address === this.buyToken) {
        this.decimals = this.tokens[key].decimals;
        this.token = this.tokens[key].market;
        this.tokenName = this.tokens[key].tokenName;
      }
    });
    if (this.sellToken === this.baseCurrencyAddress) {
      this.type = 'BUYORDER';
      this.orderType = 'BUYORDER';
    } else {
      this.type = 'SELLORDER';
      this.orderType = 'SELLORDER';
    }
    this.priceMul = this.rawLog._priceMul.toString(10);
    this.priceDiv = this.rawLog._priceDiv.toString(10);
    const fract = `${this.priceMul}/${this.priceDiv}`;
    const g = math.fraction(fract);
    const c = math.number(g);
    this.price = c;
    this.orderId = this.rawLog._id.toString(10);
    this.startAmount = this.rawLog._amount.toString(10);
    this.amount = this.rawLog._amount.toString(10);
    this.owner = this.rawLog._owner;
    this.time = this.rawLog._time.toString(10);
  }

  translate() {
    return {
      txid: this.txid,
      tokenAddress: this.tokenAddress,
      type: this.type,
      token: this.token,
      tokenName: this.tokenName,
      orderType: this.orderType,
      price: this.price,
      status: orderState.ACTIVE,
      orderId: this.orderId,
      owner: Decoder.toRunebaseAddress(this.owner.substring(2), isMainnet()),
      sellToken: this.sellToken,
      buyToken: this.buyToken,
      priceMul: this.priceMul,
      priceDiv: this.priceDiv,
      time: this.time,
      amount: this.amount,
      startAmount: this.startAmount,
      blockNum: this.blockNum,
      decimals: this.decimals,
    };
  }
}

module.exports = NewOrder;
