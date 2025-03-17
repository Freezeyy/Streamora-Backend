'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Event extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }
  Event.init({
    date: {
      type: DataTypes.DATE,
      allowNull: false, // Prevents null values
    },
    eventTitle: {
      type: DataTypes.STRING,
      allowNull: false, // Prevents null values
    },
    eventTime: {
      type: DataTypes.STRING,
      allowNull: false, // Prevents null values
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true, // Optional field
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    }
  }, {
    sequelize,
    modelName: 'Event',
  });
  return Event;
};