/**
 * a class for User Model
 * @class User
 */
module.exports = function (sequelize, DataTypes) {
  const plans = sequelize.define(
    'plans',
    {
      planName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      assertId: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      monthlyFunding: {
        defaultValue: 10,
        type: DataTypes.DOUBLE,
      },
      userId: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      classMethods: {
        indexes: [{ unique: true, fields: ['planName, userId'] }],
      },
    },
  );

  return plans;
};
