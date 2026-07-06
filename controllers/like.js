const m = require('../models');

async function index(req, res) {
  const { postId } = req.params;

  try {
    const post = await m.Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const likes = await m.Like.findAll({
      where: { post_id: postId },
      include: [{
        model: m.User,
        as: 'user',
        attributes: ['id', 'name', 'image'],
      }],
      order: [['createdAt', 'DESC']],
    });

    res.json(likes.map((like) => ({
      id: like.id,
      user_id: like.user_id,
      user: like.user,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function toggleLike(req, res) {
  const { postId } = req.params;
  const userId = req.user.id;

  try {
    const post = await m.Post.findByPk(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existingLike = await m.Like.findOne({
      where: { post_id: postId, user_id: userId },
    });

    if (existingLike) {
      await existingLike.destroy();
      const likeCount = await m.Like.count({ where: { post_id: postId } });
      return res.json({ liked: false, likeCount });
    }

    const newLike = await m.Like.create({ post_id: postId, user_id: userId });
    const likeCount = await m.Like.count({ where: { post_id: postId } });
    res.status(201).json({ liked: true, like: newLike, likeCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { index, toggleLike };
