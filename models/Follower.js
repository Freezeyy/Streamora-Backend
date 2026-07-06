'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Follower extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'follower_id', as: 'follower' });
      this.belongsTo(models.User, { foreignKey: 'following_id', as: 'following' });
    }
  }
  Follower.init({
    follower_id: DataTypes.INTEGER,
    following_id: DataTypes.INTEGER,
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'accepted',
    },
  }, {
    sequelize,
    modelName: 'Follower',
  });
  return Follower;
};