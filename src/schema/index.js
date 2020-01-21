const { makeExecutableSchema } = require('graphql-tools');
const resolvers = require('./resolvers');

// Define your types here.
const typeDefs = `

type NewOrder {
  txid: String!
  tokenAddress: String!
  txCanceled: String!
  txFulfilled: String!
  timeCanceled: String!
  timeFulfilled: String!
  orderId: String!
  token: String!
  tokenName: String!
  orderType: String!
  type: String!
  price: String!
  status: _OrderStatusType!
  owner: String!
  sellToken: String!
  buyToken: String!
  priceMul: String!
  priceDiv: String!
  time: String!
  amount: String!
  startAmount: String!
  blockNum: Int
}

type Market {
  market: String!
  tokenName: String!
  price: String!
  change: String!
  volume: String!
  address: String!
  abi: String!
  orderCount: String!
}

type BaseCurrency {
  pair: String!
  name: String!
  address: String!
}

type MarketImage {
  market: String!
  image: String
}

type FundRedeem {
  txid: String!
  type: String!
  token: String!
  tokenName: String!
  status: _FundRedeemStatusType!
  owner: String!
  time: Int!
  date: String!
  amount: Float!
  blockNum: Int
}

type Charts {
  tokenAddress: String!
  timeTable: String!
  time: Int!
  open: String!
  high: String!
  low: String!
  close: String!
  volume: Float!
}

type Trade {
  status: _TradeStatusType!
  tokenAddress: String!
  type: String!
  txid: String!
  date: String!
  from: String!
  to: String!
  soldTokens: String!
  boughtTokens: String!
  tokenName: String!
  token: String!
  orderType: String!
  price: String!
  orderId: String!
  time: Int
  amount: String!
  blockNum: Int
  gasLimit: String!
  gasPrice: String!
  gasUsed: Int
}


type Transaction {
  type: _TransactionType!
  status: _TransactionStatus!
  txid: String
  createdTime: String!
  blockNum: Int
  blockTime: String
  gasLimit: String!
  gasPrice: String!
  gasUsed: Int
  version: Int!
  senderAddress: String!
  receiverAddress: String
  name: String
  options: [String!]
  token: String!
  amount: String
}

type Block {
  blockNum: Int!
  blockTime: String!
}

type syncInfo {
  syncBlockNum: Int
  syncBlockTime: String
  syncPercent: Int
  peerNodeCount: Int
  addressBalances: [AddressBalance]
}

type fundRedeemInfo {
  txid: String!
  type: String!
  token: String!
  tokenName: String!
  status: _FundRedeemStatusType!
  owner: String!
  time: Int!
  date: String!
  amount: Float!
  blockNum: Int
}

type myOrderInfo {
  txid: String!
  tokenAddress: String!
  txCanceled: String!
  txFulfilled: String!
  timeCanceled: String!
  timeFulfilled: String!
  orderId: String!
  token: String!
  tokenName: String!
  orderType: String!
  type: String!
  price: String!
  status: _OrderStatusType!
  owner: String!
  sellToken: String!
  buyToken: String!
  priceMul: String!
  priceDiv: String!
  time: String!
  amount: String!
  startAmount: String!
  blockNum: Int
}

type myTradeInfo {
  status: _TradeStatusType!
  txid: String!
  tokenAddress: String!
  date: String!
  from: String!
  to: String!
  soldTokens: String!
  boughtTokens: String!
  token: String!
  tokenName: String!
  orderType: String!
  type: String!
  price: String!
  orderId: String!
  time: Int
  amount: String!
  blockNum: Int
}

type marketInfo {
  market: String!
  tokenName: String!
  price: String!
  change: String!
  volume: String!
  address: String!
  abi: String!
  orderCount: String!
}

type chartInfo {
  tokenAddress: String!
  timeTable: String!
  time: Int!
  open: String!
  high: String!
  low: String!
  close: String!
  volume: Float!
}

type Query {
  allCharts(filter: ChartFilter, orderBy: [Order!], limit: Int, skip: Int): [Charts]!
  allFundRedeems(filter: FundRedeemFilter, orderBy: [Order!], limit: Int, skip: Int): [FundRedeem]!
  allMarkets(filter: MarketFilter, orderBy: [Order!], limit: Int, skip: Int): [Market]!
  allMarketImages(filter: MarketImageFilter, orderBy: [Order!], limit: Int, skip: Int): [MarketImage]!
  allTrades(filter: TradeFilter, orderBy: [Order!], limit: Int, skip: Int): [Trade]!
  allNewOrders(filter: NewOrderFilter, orderBy: [Order!], limit: Int, skip: Int): [NewOrder]!
  allTransactions(filter: TransactionFilter, orderBy: [Order!], limit: Int, skip: Int): [Transaction]!
  getBaseCurrency(filter: BaseCurrencyFilter, orderBy: [Order!], limit: Int, skip: Int): [BaseCurrency]!
  syncInfo(includeBalance: Boolean): syncInfo!
  fundRedeemInfo: fundRedeemInfo!
  myOrderInfo: myOrderInfo!
  activeOrderInfo: myOrderInfo!
  fulfilledOrderInfo: myOrderInfo!
  canceledOrderInfo: myOrderInfo!
  sellOrderInfo: myOrderInfo!
  myTradeInfo: myTradeInfo!
  buyHistoryInfo: myTradeInfo!
  sellHistoryInfo: myTradeInfo!
  buyOrderInfo: myOrderInfo!
  selectedOrderInfo: myOrderInfo!
  marketInfo: marketInfo!
  chartInfo: chartInfo!
}

input BaseCurrencyFilter {
  OR: [BaseCurrencyFilter!]
  pair: String
  name: String
  address: String
}

input ChartFilter {
  OR: [ChartFilter!]
  tokenAddress: String
  timeTable: String
  time: Int
  open: String
  high: String
  low: String
  close: String
  volume: Float
}

input FundRedeemFilter {
  OR: [FundRedeemFilter!]
  txid: String
  type: String
  token: String
  tokenName: String
  status: _FundRedeemStatusType
  owner: String
  time: Int
  date: String
  amount: Float
  blockNum: Int
}

input TradeFilter {
  OR: [TradeFilter!]
  status: _TradeStatusType
  tokenAddress: String
  type: String
  txid: String
  from: String
  to: String
  soldTokens: String
  boughtTokens: String
  token: String
  tokenName: String
  orderType: String
  price: String
  orderId: String
  time: Int
  amount: String
  blockNum: Int
}

input NewOrderFilter {
  OR: [NewOrderFilter!]
  txid: String
  tokenAddress: String
  token: String
  tokenName: String
  orderType: String
  type: String
  status: _OrderStatusType
  price: String
  orderId: String
  owner: String
  sellToken: String
  buyToken: String
  priceMul: String
  priceDiv: String
  time: String
  amount: String
  blockNum: Int
}

input MarketFilter {
  OR: [MarketFilter!]
  market: String
  tokenName: String
  price: String
  change: String
  volume: String
}

input MarketImageFilter {
  OR: [MarketImageFilter!]
  market: String
  image: String
}

input TransactionFilter {
  OR: [TransactionFilter!]
  type: _TransactionType
  status: _TransactionStatus
  senderAddress: String
  senderQAddress: String
}

type Mutation {
  transfer(
    senderAddress: String!
    receiverAddress: String!
    token: String!
    amount: String!
  ): Transaction

  transferExchange(
    senderAddress: String!
    receiverAddress: String!
    token: String!
    amount: String!
  ): Transaction

  redeemExchange(
    senderAddress: String!
    receiverAddress: String!
    token: String!
    amount: String!
  ): Transaction

  orderExchange(
    senderAddress: String!
    receiverAddress: String!
    token: String!
    amount: String!
    price: String!
    orderType: String!
  ): Transaction

  cancelOrderExchange(
    senderAddress: String!
    orderId: String!
  ): Transaction

  executeOrderExchange(
    senderAddress: String!
    orderId: String!
    exchangeAmount: String!
  ): Transaction

}

type Subscription {
  onSyncInfo : syncInfo
  onFundRedeemInfo(owner: String!) : fundRedeemInfo
  onCanceledOrderInfo (status: String!) : myOrderInfo
  onActiveOrderInfo : myOrderInfo
  onFulfilledOrderInfo (status: String!) : myOrderInfo
  onMyTradeInfo(from: String!, to: String!) : myTradeInfo
  onBuyHistoryInfo (token: String!, orderType: String!) : myTradeInfo
  onSellHistoryInfo (token: String!, orderType: String!) : myTradeInfo
  onSelectedOrderInfo : myOrderInfo
  onSellOrderInfo (orderType: String!, token: String!, status: String!) : myOrderInfo
  onBuyOrderInfo (orderType: String!, token: String!, status: String!) : myOrderInfo
  onChartInfo (timeTable: String!, tokenAddress: String!) : chartInfo
}

input Order {
  field: String!
  direction: _OrderDirection!
}

type AddressBalance {
  address: String!,
  balance: String!
}

enum _OrderStatusType {
  FULFILLED
  ACTIVE
  CANCELED
  PENDING
  PENDINGCANCEL
}

enum _FundRedeemStatusType {
  CONFIRMED
  PENDING
  FAIL
}

enum _TradeStatusType {
  CONFIRMED
  PENDING
  FAIL
}

enum _OrderDirection {
  DESC
  ASC
}

enum _TransactionType {
  TRANSFER
  DEPOSITEXCHANGE
  WITHDRAWEXCHANGE
  BUYORDER
  SELLORDER
  CANCELORDER
  EXECUTEORDER
}

enum _TransactionStatus {
   PENDING
   FAIL
   SUCCESS
   CONFIRMED
   PENDINGCANCEL
}
`;

// Generate the schema object from your types definition.
module.exports = makeExecutableSchema({ typeDefs, resolvers });
