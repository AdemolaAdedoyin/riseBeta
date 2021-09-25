/**
 * a class for User Model
 * @class User
 */
module.exports = function (sequelize, DataTypes) {
  const assertClasses = sequelize.define(
    'assertClasses',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      riskParameter: {
        allowNull: false,
        type: DataTypes.ENUM('highRisk', 'lowRisk', 'mediumRisk'),
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      classMethods: {
        indexes: [{ unique: true, fields: ['name'] }],
      },
    },
  );

  return assertClasses;
};
