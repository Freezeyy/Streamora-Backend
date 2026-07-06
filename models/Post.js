const {
  Model,
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Post extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      this.belongsTo(models.Group, { foreignKey: 'group_id', as: 'group' });
      this.hasMany(models.Comment, { foreignKey: 'post_id', as: 'comments' });
      this.hasMany(models.Like, { foreignKey: 'post_id', as: 'likes' });
      this.hasMany(models.Media, { foreignKey: 'post_id', as: 'media' });
    }
  }
  Post.init({
    user_id: DataTypes.STRING,
    content: DataTypes.TEXT,
    group_id: DataTypes.INTEGER,
    moderation_status: DataTypes.STRING(20),
    moderated_by: DataTypes.INTEGER,
    moderated_at: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Post',
  });
  return Post;
};
