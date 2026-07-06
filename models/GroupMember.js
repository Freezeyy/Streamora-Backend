const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class GroupMember extends Model {
    static associate(models) {
      this.belongsTo(models.Group, { foreignKey: 'group_id', as: 'group' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  GroupMember.init({
    group_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    role: {
      type: DataTypes.STRING(20),
      defaultValue: 'member',
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'accepted',
    },
  }, {
    sequelize,
    modelName: 'GroupMember',
  });

  return GroupMember;
};
