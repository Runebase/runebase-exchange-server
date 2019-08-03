#!/bin/bash

echo 'Compiling TokenRegistry.sol into /build'
solc ..=.. --optimize --bin --abi --hashes --allow-paths tokens/libs -o build --overwrite RegisterTokens/TokenRegistry.sol

echo 'Compiling PRED.sol into /build'
solc ..=.. --optimize --bin --abi --hashes --allow-paths tokens/libs -o build --overwrite tokens/PRED.sol

echo 'Compiling FUN.sol into /build'
solc ..=.. --optimize --bin --abi --hashes --allow-paths tokens/libs -o build --overwrite tokens/FUN.sol
