/**
 * a Model class for Wallets
 * @class wallet
 * @author Adedoyin Ademola
 */
module.exports = (sequelize, DataTypes) => {
  const wallet = sequelize.define('wallet', {
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    balance: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD',
    },
    lock_code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reset_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastUpdatedRef: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    indexes: [{ unique: true, fields: ['userId', 'currency'] }],
    paranoid: true,
    classMethods: {
      associate: () => {
      },
    },
  });

  return wallet;
};
