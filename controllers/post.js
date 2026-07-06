const m = require('../models');
const path = require('path');
const { Op } = require('sequelize');
const upload = require('../middleware/upload');
const g = require('../helper/group');
const fileStorage = require('../config/storage');

const MEDIA_ATTRIBUTES = ['id', 'media_path', 'file_name'];

function sanitizeFileName(originalName) {
  const base = path.basename(String(originalName || '').trim() || 'attachment');
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, '_').replace(/_+/g, '_');
  return cleaned.slice(0, 255) || 'attachment';
}

function buildMediaRecord(file, postId) {
  return m.Media.create({
    post_id: postId,
    media_path: fileStorage.postMediaUrl(file.filename),
    file_name: sanitizeFileName(file.originalname),
  });
}

function buildPostIncludes(req) {
  const includes = [
    { model: m.User, attributes: ['id', 'name', 'image'], as: 'user' },
    { model: m.Media, as: 'media', attributes: MEDIA_ATTRIBUTES },
    { model: m.Group, as: 'group', attributes: ['id', 'name', 'slug', 'is_private'] },
  ];

  if (req.query.with && req.query.with.includes('comments')) {
    includes.push({
      model: m.Comment,
      as: 'comments',
      include: [
        {
          model: m.User,
          as: 'user',
          attributes: ['id', 'name', 'image'],
        },
      ],
    });
  }

  if (req.query.with && req.query.with.includes('likes')) {
    includes.push({
      model: m.Like,
      as: 'likes',
      attributes: ['user_id'],
    });
  }

  return includes;
}

async function index(req, res) {
  try {
    const posts = await m.Post.findAll({
      include: buildPostIncludes(req),
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error });
  }
}

async function feed(req, res) {
  const viewerId = req.user.id;

  try {
    const acceptedFollowing = await m.Follower.findAll({
      where: { follower_id: viewerId, status: 'accepted' },
      attributes: ['following_id'],
    });
    const followingIds = acceptedFollowing.map((row) => row.following_id);

    const publicUsers = await m.User.findAll({
      where: { is_private: false },
      attributes: ['id'],
    });
    const publicUserIds = publicUsers.map((user) => user.id);

    const allowedUserIds = [...new Set([viewerId, ...followingIds, ...publicUserIds])];

    const followedGroups = await m.GroupMember.findAll({
      where: { user_id: viewerId, status: g.STATUS.ACCEPTED },
      attributes: ['group_id'],
    });
    const followedGroupIds = followedGroups.map((row) => row.group_id);

    const feedConditions = [
      {
        group_id: null,
        user_id: { [Op.in]: allowedUserIds },
      },
    ];

    if (followedGroupIds.length > 0) {
      feedConditions.push({
        group_id: { [Op.in]: followedGroupIds },
        moderation_status: g.MODERATION.APPROVED,
      });
    }

    const posts = await m.Post.findAll({
      where: { [Op.or]: feedConditions },
      include: buildPostIncludes(req),
      order: [['createdAt', 'DESC']],
    });

    const enriched = await g.enrichPosts(posts, req.user.id);
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}



async function create(req, res) {
  try {
    // Log request body and files for debugging
    console.log('Request Body:', req.body);  // Should log the content of the post
    console.log("CONTENT: ", req.body.content);
    
    console.log('Files:', req.files);  // Should log the uploaded files

    const { content } = req.body;

    // Create the post first
    const post = await m.Post.create({
      user_id: req.user.id,
      content,
      group_id: null,
      moderation_status: null,
    });

    // Log the created post details
    console.log('Created Post:', post);

    // Check if media files were uploaded
    if (req.files && req.files.length > 0) {
      // Save each media item
      const mediaPromises = req.files.map((file) => buildMediaRecord(file, post.id));

      await Promise.all(mediaPromises);
    }

    // Optionally fetch and include the media with the post
    const postWithMedia = await m.Post.findByPk(post.id, {
      include: [
        { model: m.Media, as: 'media', attributes: MEDIA_ATTRIBUTES },
        { model: m.User, attributes: ['id', 'name', 'image'], as: 'user' },
        { model: m.Group, as: 'group', attributes: ['id', 'name', 'slug'] },
      ],
    });

    const [enriched] = await g.enrichPosts(postWithMedia, req.user.id);
    res.status(201).json(enriched);
  } catch (error) {
    console.error('Error creating post:', error);  // Log any error
    res.status(500).json({ error: error.message });
  }
}



async function update(req, res) {
  try {
    const postId = req.params.postId;
    const post = await m.Post.findByPk(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (Number(post.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'You can only edit your own posts' });
    }

    if (post.group_id && post.moderation_status === g.MODERATION.PENDING) {
      // Allow edit while pending
    }

    if (req.body.content !== undefined) {
      post.content = req.body.content;
      await post.save();
    }

    let removeMediaIds = [];
    if (req.body.removeMediaIds) {
      try {
        removeMediaIds = JSON.parse(req.body.removeMediaIds);
      } catch {
        return res.status(400).json({ error: 'Invalid removeMediaIds payload' });
      }
    }

    if (removeMediaIds.length > 0) {
      await m.Media.destroy({
        where: {
          id: removeMediaIds,
          post_id: postId,
        },
      });
    }

    if (req.files && req.files.length > 0) {
      await Promise.all(req.files.map((file) => buildMediaRecord(file, postId)));
    }

    const updatedPost = await m.Post.findByPk(postId, {
      include: [
        { model: m.User, attributes: ['id', 'name', 'image'], as: 'user' },
        { model: m.Media, as: 'media', attributes: MEDIA_ATTRIBUTES },
        { model: m.Group, as: 'group', attributes: ['id', 'name', 'slug'] },
      ],
    });

    const [enriched] = await g.enrichPosts(updatedPost, req.user.id);
    res.status(200).json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while updating the post', details: error.message });
  }
}

async function destroy(req, res) {
  try {
    const postId = req.params.postId;
    const post = await m.Post.findByPk(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (!await g.canDeletePost(post, req.user.id)) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    await m.Comment.destroy({ where: { post_id: postId } });
    await m.Like.destroy({ where: { post_id: postId } });
    await m.Media.destroy({ where: { post_id: postId } });
    await post.destroy();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to delete post' });
  }
}



async function getDetails(req, res) {
  const { postId } = req.params;
  const includes = [
    { model: m.User, attributes: ['id', 'name', 'image'], as: 'user' },
    { model: m.Media, as: 'media', attributes: MEDIA_ATTRIBUTES }
  ];

  // Check if 'with' query parameter exists and includes 'comments'
  if (req.query.with && req.query.with.includes('comments')) {
    includes.push({
      model: m.Comment,
      as: 'comments',
      include: [
        {
          model: m.User,
          as: 'user',
          attributes: ['id', 'name', 'image'],
        },
      ],
    });
  }

  // Check if 'with' query parameter exists and includes 'likes'
  if (req.query.with && req.query.with.includes('likes')) {
    includes.push({
      model: m.Like,
      as: 'likes',
      attributes: ['user_id'],
    });
  }

  try {
    const post = await m.Post.findByPk(postId, {
      include: includes,
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ error });
  }
}


module.exports = { index, feed, create, update, destroy, getDetails };
