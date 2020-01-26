/* eslint no-underscore-dangle: 0 */

class Market {
  constructor(marketData) {
    this.marketData = marketData;
    this.decode();
  }

  decode() {
    this.market = this.marketData._tokenSymbol.toString(10);
    this.tokenName = this.marketData._tokenName.toString(10);
    this.address = this.marketData._tokenAddress.toString(10).substring(2);
    this.abi = this.marketData._tokenVersion.toString(10);
    this.image = this.marketData._tokenLogo.toString(10);
    this.decimals = parseInt(this.marketData._tokenDecimals.toString(10), 10);
    this.startTime = parseInt(this.marketData._time.toString(10), 10);
  }

  translate() {
    return {
      market: this.market,
      startTime: this.startTime,
      tokenName: this.tokenName,
      price: '',
      change: '',
      volume: '',
      address: this.address,
      abi: this.abi,
      image: this.image,
      decimals: this.decimals,
    };
  }
}

module.exports = Market;
