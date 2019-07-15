const chai = require('chai');
const restify = require('restify');
const corsMiddleware = require('restify-cors-middleware');
const apiRouter = require('../../route/api');

const expect = chai.expect;

let routes;

describe('API Routes', () => {
  before(() => {
    // Init Restify server
    const server = restify.createServer({
      title: 'RunebaseExchange Server',
    });
    const cors = corsMiddleware({
      origins: ['*'],
    });
    server.pre(cors.preflight);
    server.use(cors.actual);
    server.use(restify.plugins.bodyParser({ mapParams: true }));
    server.use(restify.plugins.queryParser());

    apiRouter.applyRoutes(server);
    routes = server.routes;
  });

  describe('POST', () => {
    it('should have the is-connected route', () => {
      expect(routes).to.have.property('postisconnected');
    });

    it('should have the validate-address route', () => {
      expect(routes).to.have.property('postvalidateaddress');
    });

    it('should have the get-account-address route', () => {
      expect(routes).to.have.property('postgetaccountaddress');
    });

    it('should have the get-transaction route', () => {
      expect(routes).to.have.property('postgettransaction');
    });

    it('should have the wallet-passphrase route', () => {
      expect(routes).to.have.property('postwalletpassphrase');
    });

    it('should have the wallet-lock route', () => {
      expect(routes).to.have.property('postwalletlock');
    });

    it('should have the encrypt-wallet route', () => {
      expect(routes).to.have.property('postencryptwallet');
    });

    it('should have the wallet-passphrase-change route', () => {
      expect(routes).to.have.property('postwalletpassphrasechange');
    });

    it('should have the backup-wallet route', () => {
      expect(routes).to.have.property('postbackupwallet');
    });

    it('should have the import-wallet route', () => {
      expect(routes).to.have.property('postimportwallet');
    });

    it('should have the get-block route', () => {
      expect(routes).to.have.property('postgetblock');
    });

    it('should have the get-block-hash route', () => {
      expect(routes).to.have.property('postgetblockhash');
    });

    it('should have the get-transaction-receipt route', () => {
      expect(routes).to.have.property('postgettransactionreceipt');
    });

    it('should have the search-logs route', () => {
      expect(routes).to.have.property('postsearchlogs');
    });

    it('should have the approve route', () => {
      expect(routes).to.have.property('postapprove');
    });

    it('should have the allowance route', () => {
      expect(routes).to.have.property('postallowance');
    });

    it('should have the pred-balance route', () => {
      expect(routes).to.have.property('postpredbalance');
    });

    it('should have the version route', () => {
      expect(routes).to.have.property('postversion');
    });

    it('should have the withdraw route', () => {
      expect(routes).to.have.property('postwithdraw');
    });

    it('should have the total-runebase-value route', () => {
      expect(routes).to.have.property('posttotalrunebasevalue');
    });

    it('should have the total-pred-value route', () => {
      expect(routes).to.have.property('posttotalpredvalue');
    });

    it('should have the status route', () => {
      expect(routes).to.have.property('poststatus');
    });

    it('should have the did-withdraw route', () => {
      expect(routes).to.have.property('postdidwithdraw');
    });
  });

  describe('GET', () => {
    it('should have the get-wallet-info route', () => {
      expect(routes).to.have.property('getgetwalletinfo');
    });

    it('should have the list-address-groupings route', () => {
      expect(routes).to.have.property('getlistaddressgroupings');
    });

    it('should have the list-unspent route', () => {
      expect(routes).to.have.property('getlistunspent');
    });

    it('should have the get-blockchain-info route', () => {
      expect(routes).to.have.property('getgetblockchaininfo');
    });

    it('should have the get-block-count route', () => {
      expect(routes).to.have.property('getgetblockcount');
    });
  });
});
