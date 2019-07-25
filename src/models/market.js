/* eslint no-underscore-dangle: 0 */

const _ = require('lodash');
const { Decoder, Utils } = require('rweb3');

class Market {
  constructor(market, tokenData) {
    this.market = market;
    this.tokenData = tokenData;
    this.decode();
  }

  decode() {
    console.log('tokenData ' + this.tokenData);
  }

  translate() {
    return {
      market: this.market,
      tokenName: this.tokenData['TokenName'],
      price: '',
      change: '',
      volume: '',
      address: this.tokenData['Address'],
      abi: JSON.stringify(this.tokenData['Abi']),
      image: this.tokenData['Image'],
    };
  }
}

module.exports = Market;
