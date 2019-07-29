const { Router } = require('restify-router');
const restify = require('restify');
const Blockchain = require('../api/blockchain');
const Wallet = require('../api/wallet');
const Token = require('../api/token');
const Transaction = require('../api/transaction');
const RunebaseUtils = require('../api/runebase_utils');
const EmitterHelper = require('../utils/emitterHelper');
const { getInstance } = require('../rclient');
const { getContractMetadata } = require('../config');

const apiRouter = new Router();



function onRequestSuccess(res, result, next) {
  res.send(200, { result });
  next();
}

function onRequestError(res, err, next) {
  res.send(500, { error: err.message });
  next();
}

/*Exchange*/



/*MetaData*/
apiRouter.get('/metadata', (req, res, next) => {
  getContractMetadata()
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.get('/metadata/:option1?', (req, res, next) => {
  getContractMetadata()
    .then((result) => {
      if (result[req.params.option1] === undefined) {
        onRequestSuccess(res, result, next);
      }
      if (result[req.params.option1] !== undefined) {
        onRequestSuccess(res, result[req.params.option1], next);
      }
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.get('/metadata/:option1/:option2?', (req, res, next) => {
  getContractMetadata()
    .then((result) => {
      if (result[req.params.option1][req.params.option2] === undefined) {
        res.send(500, "MetaData Not Found");
      }
      onRequestSuccess(res, result[req.params.option1][req.params.option2], next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});
apiRouter.get('/metadata/:option1/:option2/:option3?', (req, res, next) => {
  getContractMetadata()
    .then((result) => {
      if (result[req.params.option1][req.params.option2][req.params.option3] === undefined) {
        res.send(500, "MetaData Not Found");
      }
      onRequestSuccess(res, result[req.params.option1][req.params.option2][req.params.option3], next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

/* Misc */
apiRouter.post('/is-connected', (req, res, next) => {
  getInstance().isConnected()
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

/* RunebaseUtils */
apiRouter.post('/validate-address', (req, res, next) => {
  RunebaseUtils.validateAddress(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

/* Wallet */
apiRouter.post('/get-label-address', (req, res, next) => {
  Wallet.getAddressesByLabel(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.post('/get-transaction', (req, res, next) => {
  Wallet.getTransaction(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.get('/get-wallet-info', (req, res, next) => {
  Wallet.getWalletInfo()
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.get('/list-address-groupings', (req, res, next) => {
  Wallet.listAddressGroupings()
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.get('/list-unspent', (req, res, next) => {
  Wallet.listUnspent()
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.post('/wallet-passphrase', (req, res, next) => {
  Wallet.walletPassphrase(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.post('/wallet-lock', (req, res, next) => {
  Wallet.walletLock(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.post('/encrypt-wallet', (req, res, next) => {
  Wallet.encryptWallet(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.post('/wallet-passphrase-change', (req, res, next) => {
  Wallet.walletPassphraseChange(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.post('/backup-wallet', (req, res, next) => {
  EmitterHelper.onBackupWallet();
  res.send(200);
  next();
});

apiRouter.post('/import-wallet', (req, res, next) => {
  EmitterHelper.onImportWallet();
  res.send(200);
  next();
});

/* Blockchain */
apiRouter.post('/get-block', (req, res, next) => {
  Blockchain.getBlock(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.get('/get-blockchain-info', (req, res, next) => {
  Blockchain.getBlockchainInfo()
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.get('/get-block-count', (req, res, next) => {
  Blockchain.getBlockCount()
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.post('/get-block-hash', (req, res, next) => {
  Blockchain.getBlockHash(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.post('/get-transaction-receipt', (req, res, next) => {
  Blockchain.getTransactionReceipt(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.post('/search-logs', (req, res, next) => {
  Blockchain.searchLogs(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});


/* PredictionToken */
apiRouter.post('/approve', (req, res, next) => {
  Token.approve(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.post('/allowance', (req, res, next) => {
  Token.allowance(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

apiRouter.post('/token-balance', (req, res, next) => {
  Token.balanceOf(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

/* Transactions */
apiRouter.post('/transaction-cost', (req, res, next) => {
  Transaction.transactionCost(req.params)
    .then((result) => {
      onRequestSuccess(res, result, next);
    }, (err) => {
      onRequestError(res, err, next);
    });
});

module.exports = apiRouter;
