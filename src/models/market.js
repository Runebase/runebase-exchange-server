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
      if (metadata['Tokens'][key]['Pair'] === this.market) {
        this.tokenName = metadata['Tokens'][key]['TokenName'];
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
