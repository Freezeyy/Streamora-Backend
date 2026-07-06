const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Group extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      this.hasMany(models.GroupMember, { foreignKey: 'group_id', as: 'members' });
      this.hasMany(models.Post, { foreignKey: 'group_id', as: 'posts' });
      this.belongsToMany(models.User, {
        through: models.GroupMember,
        foreignKey: 'group_id',
        otherKey: 'user_id',
        as: 'users',
      });
    }
  }

  Group.init({
    name: DataTypes.STRING(120),
    slug: DataTypes.STRING(140),
    description: DataTypes.TEXT,
    is_private: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    created_by: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'Group',
  });

  return Group;
};
