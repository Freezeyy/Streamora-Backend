const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Story extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  Story.init({
    user_id: DataTypes.INTEGER,
    media_path: DataTypes.STRING,
    media_type: DataTypes.ENUM('image', 'video'),
    expires_at: DataTypes.DATE,
    overlays: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
  }, {
    sequelize,
    modelName: 'Story',
  });

  return Story;
};
