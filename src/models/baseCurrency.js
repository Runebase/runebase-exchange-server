/* eslint no-underscore-dangle: 0 */

const _ = require('lodash');
const { Decoder, Utils } = require('rweb3');

class BaseCurrency {
  constructor(currency) {
    this.currency = currency;
  }


  translate() {
    return {
      pair: this.currency['Pair'],
      name: this.currency['Name'],
      address: this.currency['Address'],
    };
  }
}

module.exports = BaseCurrency;
