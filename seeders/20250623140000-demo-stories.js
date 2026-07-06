'use strict';

const fs = require('fs');
const path = require('path');
const fileStorage = require('../config/storage');

const STORY_USER_IDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const VIEWER_USER_ID = 1;

// Minimal valid JPEG (1×1) for local story media paths
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
  'base64',
);

function ensureSeedMediaFiles() {
  const uploadsDir = fileStorage.storiesDir();

  STORY_USER_IDS.forEach((userId) => {
    const filename = `seed-story-${userId}.jpg`;
    fs.writeFileSync(path.join(uploadsDir, filename), TINY_JPEG);
  });
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    ensureSeedMediaFiles();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const stories = STORY_USER_IDS.map((userId) => ({
      user_id: userId,
      media_path: `/uploads/stories/seed-story-${userId}.jpg`,
      media_type: 'image',
      expires_at: expiresAt,
      overlays: JSON.stringify([]),
      createdAt: now,
      updatedAt: now,
    }));

    const follows = STORY_USER_IDS.map((followingId) => ({
      follower_id: VIEWER_USER_ID,
      following_id: followingId,
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
    }));

    await queryInterface.bulkInsert('Stories', stories);
    await queryInterface.bulkInsert('Followers', follows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Stories', {
      media_path: STORY_USER_IDS.map((id) => `/uploads/stories/seed-story-${id}.jpg`),
    });

    await queryInterface.bulkDelete('Followers', {
      follower_id: VIEWER_USER_ID,
      following_id: STORY_USER_IDS,
    });

    STORY_USER_IDS.forEach((userId) => {
      const filePath = fileStorage.resolveDiskPath(`/uploads/stories/seed-story-${userId}.jpg`);
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
  },
};
