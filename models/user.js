const {
  Model,
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    // static associate(models) {
    //   this.belongsTo(models.Role);
    //   this.hasMany(models.Post, { foreignKey: 'user_id', as: 'posts' });
    //   this.hasMany(models.Comment, { foreignKey: 'user_id', as: 'comments' });
    //   this.hasMany(models.Follower, { foreignKey: 'follower_id', as: 'followers' });
    // }

    static associate(models) {
      this.belongsTo(models.Role);
      this.hasMany(models.Post, { foreignKey: 'user_id', as: 'posts' });
      this.hasMany(models.Comment, { foreignKey: 'user_id', as: 'comments' });
      
      // Followers of this user
      this.belongsToMany(models.User, {
        through: models.Follower,
        foreignKey: 'following_id', // ID of the user being followed
        otherKey: 'follower_id', // ID of the user who follows
        as: 'followers', // Alias for accessing followers
      });

      // Users this user is following
      this.belongsToMany(models.User, {
        through: models.Follower,
        foreignKey: 'follower_id', // ID of the user who follows
        otherKey: 'following_id', // ID of the user being followed
        as: 'following', // Alias for accessing users this user is following
      });
    }
  }
  User.init({
    name: DataTypes.STRING,
    password: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    image: DataTypes.TEXT,
    reset_token: DataTypes.STRING,
    verifiedAt: DataTypes.DATE,
    RoleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    }
  }, {
    sequelize,
    modelName: 'User',
  });
  return User;
};
