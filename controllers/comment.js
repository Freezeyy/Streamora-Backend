const m = require('../models');

async function index(req, res) {
  const { postId } = req.params;
  try {
    const comments = await m.Comment.findAll({
      where: { post_id: postId },
      order: [['createdAt', 'ASC']],
      include: [
        { model: m.User, as: 'user', attributes: ['id', 'name', 'image'] },
      ],
    });
    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: error.message });
  }
}

async function create(req, res) {
  const { postId } = req.params;
  const { comment } = req.body;

  if (!comment?.trim()) {
    res.status(400).json({ error: 'Comment cannot be empty' });
    return;
  }

  try {
    const newComment = await m.Comment.create({
      post_id: postId,
      user_id: req.user.id,
      comment: comment.trim(),
    });

    const fullComment = await m.Comment.findByPk(newComment.id, {
      include: [
        { model: m.User, as: 'user', attributes: ['id', 'name', 'image'] },
      ],
    });

    res.status(201).json(fullComment);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to create comment' });
  }
}

module.exports = { index, create };
