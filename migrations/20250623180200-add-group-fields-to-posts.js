module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Posts', 'group_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Posts', 'moderation_status', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('Posts', 'moderated_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Posts', 'moderated_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Posts', 'moderated_at');
    await queryInterface.removeColumn('Posts', 'moderated_by');
    await queryInterface.removeColumn('Posts', 'moderation_status');
    await queryInterface.removeColumn('Posts', 'group_id');
  },
};
