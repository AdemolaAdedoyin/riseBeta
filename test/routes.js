const mocha = require('mocha');
const request = require('supertest');
const chai = require('chai');
const server = require('../server');
const models = require('../models');

const { expect } = chai;

const { describe } = mocha;
const { it } = mocha;
const { before } = mocha;

const r = {};

describe('Initializing Payment Gateway Test Integration Test', () => {
  before((done) => {
    models.sequelize.queryInterface.dropAllTables({}).then((t) => {
      console.log('>>> All tables Dropped', JSON.stringify(t));
      return models.sequelize.sync({ force: false });
    }).then(() => {
      console.log('>>> Database Connected and Tables Created Successfully');
      done();
    });
  });

  it('Signup SUCCESS', (done) => {
    request(server)
      .post('/v1/auth/signup')
      .send({
        name: 'dapo',
        email: 'dapo@flutterwavego.com',
        password: 'remember',
      })
      .end((err, res) => {
        if (err) throw err;
        r.user = res.body.data;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('id');
        done();
      });
  });

  it('Signup SUCCESS', (done) => {
    request(server)
      .post('/v1/auth/signup')
      .send({
        name: 'dayo',
        email: 'dayo@flutterwavego.com',
        password: 'remember',
      })
      .end((err, res) => {
        if (err) throw err;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('id');
        done();
      });
  });

  it('Log in SUCCESS', (done) => {
    request(server)
      .post('/v1/auth/login')
      .send({
        email: 'dapo@flutterwavego.com',
        password: 'remember',
      })
      .end((err, res) => {
        if (err) throw err;
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('token');
        expect(res.body.data).to.have.property('name');
        r.token = res.body.data.token;
        done();
      });
  });

  it('Get wallet SUCCESS', (done) => {
    request(server)
      .get(`/v1/wallet?userId=${r.user.id}`)
      .set('Authorization', r.token)
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.lengthOf(1);
        done();
      });
  });

  it('Get banks SUCCESS', (done) => {
    request(server)
      .get('/v1/banks')
      .set('Authorization', r.token)
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        done();
      });
  });

  it('Create beneficiary SUCCESS', (done) => {
    request(server)
      .post('/v1/beneficiary')
      .set('Authorization', r.token)
      .send({
        accountNumber: '0690000005',
        accountName: 'Adetokunbo',
        bankCode: '044',
      })
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.have.property('accountNumber');
        expect(res.body.data).to.be.a('object');
        r.beneficiary = res.body.data;
        done();
      });
  });

  it('Get beneficiaries SUCCESS', (done) => {
    request(server)
      .get('/v1/beneficiary')
      .set('Authorization', r.token)
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data).to.have.property('response');
        done();
      });
  });

  it('Card Fund Wallet SUCCESS', (done) => {
    request(server)
      .post('/v1/fund')
      .set('Authorization', r.token)
      .send({
        firstname: 'Okoi',
        lastname: 'Ibiang',
        phonenumber: '+2348067415830',
        email: 'ibiang_o@bts.com.ng',
        card_no: '4187427415564246',
        cvv: '828',
        expiry_year: '21',
        expiry_month: '09',
        pin: '3310',
        amount: 10000.0,
        charge_with: 'card',
        charge_currency: 'NGN',
        disburse_currency: 'NGN',
      })
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data).to.have.property('amount');
        r.cardFundedTxn = res.body.data;
        done();
      });
  });

  it('Validate Card Fund SUCCESS', (done) => {
    request(server)
      .get(`/v1/fund/card/validate?rc=00&transactionStatus=success&responseMessage=Wallet Funding Successful&id=22717&ref=${r.cardFundedTxn.flutterReference}`)
      .set('Authorization', r.token)
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data).to.have.property('ref');
        done();
      });
  });

  it('Account Fund Wallet SUCCESS', (done) => {
    request(server)
      .post('/v1/fund')
      .set('Authorization', r.token)
      .send({
        firstname: 'Okoi',
        lastname: 'Ibiang',
        phonenumber: '+2348067415830',
        email: 'ibiang_o@bts.com.ng',
        amount: 10000.0,
        charge_with: 'account',
        account_number: '0000000000',
        code: '057',
        charge_currency: 'NGN',
        disburse_currency: 'NGN',
      })
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data.status).to.be.equal(true);
        r.accountFundedTxn = res.body.data.data;
        done();
      });
  });

  it('Validate birthday SUCCESS', (done) => {
    request(server)
      .post('/v1/fund/account/validate')
      .set('Authorization', r.token)
      .send({
        birthday: '2017-03-17',
        reference: r.accountFundedTxn.reference,
      })
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data.status).to.be.equal(true);
        done();
      });
  });

  it('Validate otp SUCCESS', (done) => {
    request(server)
      .post('/v1/fund/account/validate')
      .set('Authorization', r.token)
      .send({
        otp: '123456',
        reference: r.accountFundedTxn.reference,
      })
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data.status).to.be.equal(true);
        done();
      });
  });

  it('Validate token SUCCESS', (done) => {
    request(server)
      .post('/v1/fund/account/validate')
      .set('Authorization', r.token)
      .send({
        otp: '123456',
        reference: r.accountFundedTxn.reference,
      })
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data.status).to.be.equal(true);
        expect(res.body.data.data.status).to.be.equal('success');
        done();
      });
  });

  it('Account charge callback SUCCESS', (done) => {
    request(server)
      .get(`/v1/fund/account/validate?reference=${r.accountFundedTxn.reference}`)
      .set('Authorization', r.token)
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data.status).to.be.equal(true);
        expect(res.body.data.data.status).to.be.equal('success');
        done();
      });
  });

  it('Disburse Via Email SUCCESS', (done) => {
    request(server)
      .post('/v1/disburse')
      .set('Authorization', r.token)
      .send({
        name: 'asd',
        amount: 100,
        lock: 'remember',
        currency: 'NGN',
        medium: 'email',
        destinationEmail: 'dayo@flutterwavego.com',
      })
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data).to.have.property('amount');
        done();
      });
  });

  it('Disburse Via Beneficiary SUCCESS', (done) => {
    request(server)
      .post('/v1/disburse')
      .set('Authorization', r.token)
      .send({
        name: 'asd',
        amount: 100,
        lock: 'remember',
        currency: 'NGN',
        medium: 'beneficiary',
        beneficiaryId: r.beneficiary.id,
      })
      .end((err, res) => {
        if (err) throw err;
        expect(res.body.status).to.be.equal('success');
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.a('object');
        expect(res.body.data).to.have.property('responsecode');
        done();
      });
  });
});
