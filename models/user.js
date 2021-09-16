/**
 * a class for User Model
 * @class User
 */
module.exports = function (sequelize, DataTypes) {
  const users = sequelize.define(
    'users',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      timestamps: true,
      paranoid: true,
      classMethods: {
        indexes: [{ unique: true, fields: ['email'] }],
      },
    },
  );

  return users;
};
