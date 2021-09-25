/**
 * A class model for beneficiary
 * @class beneficiary
 * @author Ademola Adedoyin
 */
module.exports = function (sequelize, DataTypes) {
  const beneficiary = sequelize.define('beneficiary', {
    /**
     * @property accountNumber
     * @type {String} account number of the beneficiary
     */
    accountNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    /**
     * @property accountName
     * @type {String} name of the account number used as be beneficiary account
     */
    accountName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    /**
     * @property bankCode
     * @type {String} code representing the bank used
     */
    bankCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD',
    },
  }, {
    paranoid: true,
    classMethods: {
      associate() {
      },
    },
  });

  return beneficiary;
};
