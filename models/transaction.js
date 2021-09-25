/**
 * a Model class for Transactions
 * @class wallet
 * @author Adedoyin Ademola
 */
module.exports = function (sequelize, DataTypes) {
  const transaction = sequelize.define('transactions', {
    amount: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    fee: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM,
      values: ['waiting', 'pending', 'processing', 'retrying', 'completed', 'failed', 'error'],
      defaultValue: 'pending',
    },
    type: {
      type: DataTypes.ENUM(
        'disburse',
        'fund',
      ),
      allowNull: false,
    },
    source: {
      type: DataTypes.ENUM('card', 'wallet', 'system', 'account', 'plan'),
      allowNull: true,
    },
    source_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD',
    },
    dest: {
      type: DataTypes.ENUM('beneficiary', 'wallet', 'system', 'plan'),
      allowNull: true,
    },
    dest_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ref: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    responseMessage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    responseCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    flutterReference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    meta: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    walletCharged: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    reversed: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
  }, {
    indexes: [{ unique: true, fields: ['ref', 'userId'] }],
    paranoid: true,
    classMethods: {
      associate: () => {
      },
    },
  });

  return transaction;
};
