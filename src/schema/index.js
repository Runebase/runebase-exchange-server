const { makeExecutableSchema } = require('graphql-tools');
const resolvers = require('./resolvers');

// Define your types here.
const typeDefs = `

type NewOrder {
  txid: String!
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

type FundRedeem {
  txid: String!
  type: String!
  token: String!
  tokenName: String!
  status: _FundRedeemStatusType!
  owner: String!
  time: Int!
  date: String!
  amount: String!
  blockNum: Int
}

type Trade {
  status: _TradeStatusType!
  type: String!
  txid: String!
  date: String!
  from: String!
  to: String!
  soldTokens: String!
  boughtTokens: String!
  tokenName: String!
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
  token: _TokenType
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
  amount: String!
  blockNum: Int
}

type myOrderInfo {
  txid: String!
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


type activeOrderInfo {
  txid: String!
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


type fulfilledOrderInfo {
  txid: String!
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


type canceledOrderInfo {
  txid: String!
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

type buyOrderInfo {
  txid: String!
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

type sellOrderInfo {
  txid: String!
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

type selectedOrderInfo {
  txid: String!
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
  date: String!
  from: String!
  to: String!
  soldTokens: String!
  boughtTokens: String!
  tokenName: String!
  orderType: String!
  type: String!
  price: String!
  orderId: String!
  time: Int
  amount: String!
  blockNum: Int
}

type buyHistoryInfo {
  status: _TradeStatusType!
  txid: String!
  date: String!
  from: String!
  to: String!
  soldTokens: String!
  boughtTokens: String!
  tokenName: String!
  orderType: String!
  type: String!
  price: String!
  orderId: String!
  time: Int
  amount: String!
  blockNum: Int
}

type sellHistoryInfo {
  status: _TradeStatusType!
  txid: String!
  date: String!
  from: String!
  to: String!
  soldTokens: String!
  boughtTokens: String!
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

type Query {
  allFundRedeems(filter: FundRedeemFilter, orderBy: [Order!], limit: Int, skip: Int): [FundRedeem]!
  allMarkets(filter: MarketFilter, orderBy: [Order!], limit: Int, skip: Int): [Market]!
  allTrades(filter: TradeFilter, orderBy: [Order!], limit: Int, skip: Int): [Trade]!
  allNewOrders(filter: NewOrderFilter, orderBy: [Order!], limit: Int, skip: Int): [NewOrder]!
  allTransactions(filter: TransactionFilter, orderBy: [Order!], limit: Int, skip: Int): [Transaction]!
  syncInfo(includeBalance: Boolean): syncInfo!
  fundRedeemInfo: fundRedeemInfo!
  myOrderInfo: myOrderInfo!
  activeOrderInfo: activeOrderInfo!
  fulfilledOrderInfo: fulfilledOrderInfo!
  canceledOrderInfo: canceledOrderInfo!
  sellOrderInfo: sellOrderInfo!
  myTradeInfo: myTradeInfo!
  buyHistoryInfo: buyHistoryInfo!
  sellHistoryInfo: sellHistoryInfo!
  buyOrderInfo: buyOrderInfo!
  selectedOrderInfo: selectedOrderInfo!
  marketInfo: marketInfo!
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
  amount: String
  blockNum: Int
}

input TradeFilter {
  OR: [TradeFilter!]
  status: _TradeStatusType
  type: String
  txid: String
  from: String
  to: String
  soldTokens: String
  boughtTokens: String
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
    token: _TokenType!
    amount: String!
  ): Transaction

  transferExchange(
    senderAddress: String!
    receiverAddress: String!
    token: _TokenType!
    amount: String!
  ): Transaction

  redeemExchange(
    senderAddress: String!
    receiverAddress: String!
    token: _TokenType!
    amount: String!
  ): Transaction

  orderExchange(
    senderAddress: String!
    receiverAddress: String!
    token: _TokenType!
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
  onFundRedeemInfo : fundRedeemInfo
  onMyOrderInfo : myOrderInfo
  onCanceledOrderInfo : canceledOrderInfo
  onActiveOrderInfo : activeOrderInfo
  onFulfilledOrderInfo : fulfilledOrderInfo
  onMyTradeInfo : myTradeInfo
  onBuyHistoryInfo : buyHistoryInfo
  onSellHistoryInfo : sellHistoryInfo
  onSellOrderInfo : sellOrderInfo
  onSelectedOrderInfo : selectedOrderInfo
  onBuyOrderInfo : buyOrderInfo
  onMarketInfo : marketInfo
}

input Order {
  field: String!
  direction: _OrderDirection!
}

type AddressBalance {
  address: String!,
  runebase: String!,
  pred: String!,
  fun: String!,
  exchangerunes: String!,
  exchangepred: String!,
  exchangefun: String!,
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

enum _TokenType {
  RUNES
  PRED
  FUN
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
   PENDINGCANCEL
}
`;

// Generate the schema object from your types definition.
module.exports = makeExecutableSchema({ typeDefs, resolvers });
