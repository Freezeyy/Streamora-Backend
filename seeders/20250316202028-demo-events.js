'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
    await queryInterface.bulkInsert("Events", [
      {
        date: "2025-03-20",
        eventTitle: "Project Launch",
        eventTime: "10:00 AM",
        notes: "Launch the new project officially.",
        user_id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        date: "2025-04-10",
        eventTitle: "Team Meeting",
        eventTime: "2:00 PM",
        notes: "Discuss project progress.",
        user_id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete("Events", null, {});

  }
};
