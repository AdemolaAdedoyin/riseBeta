# RISEBETA
We want to build a source of truth for all transactions in our system. Design a transaction service that can handle the following requirements:

Funding with support for chargebacks and refunds
Withdrawals
Returns(Internal Deposits)
Can support real-time and historical consumerst and fund their USD wallet.

# Built With

The system was built using Nodejs, while consuming external Apis, e.g Flutterwaves Api, Paystacks Api, Nodemailer api

# Getting Started

## Prerequisites

Your system must have npm and node installed, and this can be done on the terminal with 

```
- npm install npm@latest -g
```

## Installation

```
- Clone the repo https://github.com/AdemolaAdedoyin/risebeta.git
- Install npm packages, `npm install`
- This is a locally hosted api, so you have to have `mySQL database server` running on your system. Either through xampp or installed using brew.
- A database to use must exist, and the name of this database will be passed when trying to start the server.
- You need to have an account on [Moneywave] (https://moneywave.azurewebsites.net/#/login), to get test api and secret keys that will be used on the system.
- You need to have an account on [paystack] (https://dashboard.paystack.com/#/login), to get test public key that will be used on the system.
```

## Usage

Configs to be passed when trying to start the server

````
- MW_API_KEY="YOUR MONEYWAVE API KEY"
- MW_SECRET="YOUR MONEYWAVE SECRET KEY"
- MW_WALLET_PASSWORD="YOUR MONEYWAVE WALLET PASSWORD"
- PAYSTACK_PUBLIC_KEY="YOUR PAYSTACK PUBLIC KEY"
- ACCOUNT_EMAIL="YOUR EMAIL TO USE FOR NOTIFICATIONS"
- ACCOUNT_PASSWORD="YOUR EMAIL PASSWORD"
- NODE_ENV="production"
Note: `NODE_ENV is the only optional config needed, and its used in the notification service`
```

To start the server, run this on your terminal
```
MW_API_KEY="YOUR MONEYWAVE API KEY" MW_SECRET="YOUR MONEYWAVE SECRET KEY" MW_WALLET_PASSWORD="YOUR MONEYWAVE WALLET PASSWORD" PAYSTACK_PUBLIC_KEY="YOUR PAYSTACK PUBLIC KEY" ACCOUNT_EMAIL="YOUR EMAIL TO USE FOR NOTIFICATIONS" ACCOUNT_PASSWORD="YOUR EMAIL PASSWORD" NODE_ENV=production npm start
```

To run the test script
```
MW_API_KEY="YOUR MONEYWAVE API KEY" MW_SECRET="YOUR MONEYWAVE SECRET KEY" MW_WALLET_PASSWORD="YOUR MONEYWAVE WALLET PASSWORD" PAYSTACK_PUBLIC_KEY="YOUR PAYSTACK PUBLIC KEY" ACCOUNT_EMAIL="YOUR EMAIL TO USE FOR NOTIFICATIONS" ACCOUNT_PASSWORD="YOUR EMAIL PASSWORD" NODE_ENV=production npm run test
```

Documentaion for the api can be found here, [doc] (https://documenter.getpostman.com/view/1676833/U16oq44V)

Contact me if any issue is encountered or token and keys are needed, adedoyinademola397@gmail.com
