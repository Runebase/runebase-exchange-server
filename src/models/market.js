/* eslint no-underscore-dangle: 0 */

const _ = require('lodash');
const { Decoder, Utils } = require('rweb3');
const { isMainnet, getContractMetadata } = require('../config');

class Market {
  constructor(market) {
    this.market = market;
    this.decode();
  }

  decode() {
    const metadata = getContractMetadata();
    for (var key in metadata['Tokens']){
      console.log(this.market);
      if (metadata['Tokens'][key]['pair'] === this.market) {
        console.log(this.market);
        this.tokenName = metadata['Tokens'][key]['tokenName'];
      }
    }
  }

  translate() {
    return {
      market: this.market,
      tokenName: this.tokenName,
      price: '',
      change: '',
      volume: '',
    };
  }
}

module.exports = Market;
