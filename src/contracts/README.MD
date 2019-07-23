##Ubtuntu18.04 Prequisites

### Install Solc

```

cd ~/
git clone --recursive https://github.com/ethereum/solidity.git
cd solidity
git checkout v0.4.25
git submodule update --init --recursive
./scripts/install_deps.sh
mkdir build
cd build
cmake .. && make
sudo make install

```

### Install GoLang

```

sudo add-apt-repository ppa:longsleep/golang-backports
sudo apt-get update
sudo apt-get install golang-go

```

### Install Solar

```

#use the ethgamble solar version or the forked solar repo on github/runebase
go get -u github.com/runebase/solar/cli/solar
export PATH=$PATH:/home/bago/go/bin:$GOPATH/bin

```

### Install Cargo

```

sudo apt-get install curl
curl https://sh.rustup.rs -sSf | sh
export PATH=$PATH:/home/bago/.cargo/bin

```

### Install Ethabi

```

cargo install ethabi-cli
export PATH=$PATH:/home/bago/.cargo/bin

```


##Compile & Deploy Contracts

###Testnet
####Start Runebased
```

#wait for -logevents resync if needed.
../../runebase/linux64/bin/runebased -testnet -rpcuser=user -rpcpassword=pass -daemon -logevents

#check current blocknumber
../../runebase/linux64/bin/runebase-cli -testnet -rpcuser=user -rpcpassword=pass getblockchaininfo

#assuming your wallet password = xxx
../../runebase/linux64/bin/runebase-cli -testnet -rpcuser=user -rpcpassword=pass walletpassphrase xxx 999999999999999999


```
####Compile & deploy
```

solar deploy radex/Radex.sol --qtum_rpc=http://user:pass@localhost:19432 --qtum_sender=5aeewynHSJoeaa86GPmWKeXorRvQfs2skv --optimize --env="testnet.exchange" --force


```

####Stop Runebased
```

../../runebase/linux64/bin/runebase-cli -testnet -rpcuser=user -rpcpassword=pass stop


```

####Edit Config MetaData
```

nano runebase-exchange-server/src/config/testnet/contract_metadata.js


```




##Register Tokens
```



```

##Testnet Desployed Contract

###Radex
```
ContractHexAddress:
efe8319e263d81773c9aa104be1cf81ac3a932dd

ContractAddress:


OwnerAddres:
5aeewynHSJoeaa86GPmWKeXorRvQfs2skv

OwnerHexAddres:
61f8668e62cccfebf939dbe9e16aaf33abbf29e4

```

###PRED Token
```
ContractHexAddress:
9611e83c9c85a8ef8dd4aeb9963e7e7128916ee5

ContractAddress:
5fQ8eBX3pWP7asbPtAF6TSYPvGj3vpShZA

OwnerAddres:
5aeewynHSJoeaa86GPmWKeXorRvQfs2skv

OwnerHexAddres:
61f8668e62cccfebf939dbe9e16aaf33abbf29e4

```
###FUN token
```
ContractHexAddress:
3ff6c7cd7d46393e1cfd15406013ab041bddecf3

ContractAddress:
5XYr2tWVfdjQ6NEJqS8qGQqEn1rCpzoPmb

OwnerAddres:
5aeewynHSJoeaa86GPmWKeXorRvQfs2skv

OwnerHexAddres:
61f8668e62cccfebf939dbe9e16aaf33abbf29e4

```

##Mainnet Desployed Contract

###Radex
```
Hex Address:

Address:

Owner:

```

###PRED Token
```
Hex Address:

Address:

Owner:

```

###FUN token
```
Hex Address:

Address:

Owner:

```

