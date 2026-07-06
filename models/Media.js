const {
  Model,
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Media extends Model {
    static associate(models) {
      this.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
    }
  }
  
  Media.init({
    post_id: DataTypes.INTEGER,
    media_path: DataTypes.STRING,
    file_name: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Media',
  });
  
  return Media;
};
