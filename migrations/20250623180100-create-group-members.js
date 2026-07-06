module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('GroupMembers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      role: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'member',
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'accepted',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('GroupMembers', ['group_id', 'user_id'], {
      unique: true,
      name: 'group_members_group_user_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('GroupMembers');
  },
};
