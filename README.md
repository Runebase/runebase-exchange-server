[![Build Status](https://travis-ci.org/runebase/runebase-exchange-server.svg?branch=master)](https://travis-ci.org/runebase/runebase-exchange-server)

# Prerequisites
1. Node 10 installed
2. You will need the Runebase client for the OS you are testing on (or building against). Download the [Runebase client](https://github.com/runebase/runebase/releases) for the correct OS and put the `bin/` folder in the corresponding dir:

        runebase-exchange-server/runebase/mac/bin         runebase-0.17.1-osx64.tar.gz
        runebase-exchange-server/runebase/win64/bin       runebase-0.17.1-win64.zip
        runebase-exchange-server/runebase/win32/bin       runebase-0.17.1-win32.zip
        runebase-exchange-server/runebase/linux64/bin     runebase-0.17.1-x86_64-linux-gnu.tar.gz
        runebase-exchange-server/runebase/linux32/bin     runebase-0.17.1-i686-pc-linux-gnu.tar.gz

# Install
1. `git clone https://github.com/runebase/runebase-exchange-server.git`
2. `cd runebase-exchange-server`
3. `npm install`

# Run Testnet Environment
1. `cd runebase-exchange-server`
2. `npm run start-test`
3. App at `127.0.0.1:8989` or GraphiQL at `127.0.0.1:8989/graphiql`

# Run Mainnet Environment
1. `cd runebase-exchange-server`
2. `npm run start-main`
3. App at `127.0.0.1:8989` or GraphiQL at `127.0.0.1:8989/graphiql`

## Graphiql Example Query

```

		allMarkets(
          filter:{
            market: "PRED"
          }
          orderBy:{
            direction: ASC
            field: "market"
          }
        )
        {
          market
          volume
          change
        }

```


# API

**Case Sensitive**

## Exchange (Graphql Url Query Examples)

### allMarkets

#### Without Filter

```

http://localhost:8989/graphql?query={allMarkets{market tokenName price volume change address abi}}

```

#### With Filter

```

http://localhost:8989/graphql?query={allMarkets(filter:{market: "PRED"}){market tokenName price volume change address abi}}

```

#### With Filter And Ordening

```

http://localhost:8989/graphql?query={allMarkets(filter:{market: "PRED"}orderBy:{ direction: ASC field: "market" }){market  tokenName  price  volume  change  address abi}}

```

### allTrades

```



```

### allNewOrders

```



```

### allFundRedeems

```



```

### allTransactions

```



```


## MetaData

### All MetaData

```

http://localhost:8989/metadata

```

### Exchange MetaData

```

http://localhost:8989/metadata/Exchange

```

### BaseCurrency MetaData

```

http://localhost:8989/metadata/BaseCurrency

```

### Tokens MetaData

```

http://localhost:8989/metadata/Tokens

```

### Token MetaData

```

http://localhost:8989/metadata/Tokens/PredictionToken
http://localhost:8989/metadata/Tokens/FunToken

```

### TokenAddress MetaData

```

http://localhost:8989/metadata/Tokens/PredictionToken/Address

```

### TokenAbi MetaData

```

http://localhost:8989/metadata/Tokens/PredictionToken/Abi

```

### TokenPair MetaData

```

http://localhost:8989/metadata/Tokens/PredictionToken/Pair

```

### TokenName MetaData

```

http://localhost:8989/metadata/Tokens/PredictionToken/TokenName

```