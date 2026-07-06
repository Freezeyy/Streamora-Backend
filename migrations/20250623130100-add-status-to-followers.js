module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Followers', 'status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'accepted',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Followers', 'status');
  },
};
