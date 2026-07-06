const { Op } = require('sequelize');
const path = require('path');
const m = require('../models');
const fileStorage = require('../config/storage');

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv', '.mpeg', '.mpg', '.3gp', '.3gpp',
]);

async function canViewUserStories(viewerId, ownerId) {
  if (Number(viewerId) === Number(ownerId)) return true;

  const follow = await m.Follower.findOne({
    where: {
      follower_id: viewerId,
      following_id: ownerId,
      status: 'accepted',
    },
  });

  return Boolean(follow);
}

function getMediaType(mimetype, filename) {
  if (mimetype && mimetype.startsWith('video/')) return 'video';

  const ext = path.extname(filename || '').toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';

  return 'image';
}

function groupStoriesByUser(stories) {
  const grouped = new Map();

  stories.forEach((story) => {
    const plain = story.toJSON ? story.toJSON() : story;
    const userId = plain.user_id;

    if (!grouped.has(userId)) {
      grouped.set(userId, {
        user: plain.user,
        stories: [],
      });
    }

    grouped.get(userId).stories.push({
      id: plain.id,
      media_path: plain.media_path,
      media_type: plain.media_type,
      expires_at: plain.expires_at,
      overlays: plain.overlays || [],
      createdAt: plain.createdAt,
    });
  });

  return Array.from(grouped.values());
}

async function getFollowingUserIds(userId) {
  const following = await m.Follower.findAll({
    where: { follower_id: userId, status: 'accepted' },
    attributes: ['following_id'],
  });

  const ids = following.map((row) => row.following_id);
  ids.push(Number(userId));
  return [...new Set(ids)];
}

async function feed(req, res) {
  try {
    const viewerId = req.user.id;
    const allowedUserIds = await getFollowingUserIds(viewerId);

    const stories = await m.Story.findAll({
      where: {
        user_id: { [Op.in]: allowedUserIds },
        expires_at: { [Op.gt]: new Date() },
      },
      include: [
        { model: m.User, as: 'user', attributes: ['id', 'name', 'image'] },
      ],
      order: [['createdAt', 'ASC']],
    });

    res.json(groupStoriesByUser(stories));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getUserStories(req, res) {
  try {
    const viewerId = req.user.id;
    const ownerId = Number(req.params.userId);

    const allowed = await canViewUserStories(viewerId, ownerId);
    if (!allowed) {
      return res.status(403).json({
        error: 'You must follow this user to view their stories',
      });
    }

    const stories = await m.Story.findAll({
      where: {
        user_id: ownerId,
        expires_at: { [Op.gt]: new Date() },
      },
      include: [
        { model: m.User, as: 'user', attributes: ['id', 'name', 'image'] },
      ],
      order: [['createdAt', 'ASC']],
    });

    if (stories.length === 0) {
      return res.json([]);
    }

    res.json(groupStoriesByUser(stories));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function create(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Story media is required' });
    }

    let overlays = [];
    if (req.body.overlays) {
      try {
        overlays = typeof req.body.overlays === 'string'
          ? JSON.parse(req.body.overlays)
          : req.body.overlays;
        if (!Array.isArray(overlays)) overlays = [];
      } catch {
        overlays = [];
      }
    }

    const mediaPath = fileStorage.storyMediaUrl(req.file.filename);
    const mediaType = getMediaType(req.file.mimetype, req.file.originalname);
    const expiresAt = new Date(Date.now() + STORY_TTL_MS);

    const story = await m.Story.create({
      user_id: req.user.id,
      media_path: mediaPath,
      media_type: mediaType,
      expires_at: expiresAt,
      overlays,
    });

    const storyWithUser = await m.Story.findByPk(story.id, {
      include: [
        { model: m.User, as: 'user', attributes: ['id', 'name', 'image'] },
      ],
    });

    res.status(201).json(storyWithUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function destroy(req, res) {
  try {
    const story = await m.Story.findByPk(req.params.storyId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (Number(story.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Not allowed to delete this story' });
    }

    await story.destroy();
    res.json({ message: 'Story deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  feed,
  getUserStories,
  create,
  destroy,
};
