/* eslint no-underscore-dangle: 0 */

class BaseCurrency {
  constructor(currency) {
    this.currency = currency;
  }


  translate() {
    return {
      pair: this.currency.Pair,
      name: this.currency.Name,
      address: this.currency.Address,
    };
  }
}

module.exports = BaseCurrency;
