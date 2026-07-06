module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Media', 'file_name', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Media', 'file_name');
  },
};
