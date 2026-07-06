const m = require('../models');

async function follow(req, res) {
  const { followingId } = req.body;
  const followerId = req.user.id;

  if (Number(followerId) === Number(followingId)) {
    return res.status(400).json({ error: 'You cannot follow yourself' });
  }

  try {
    const targetUser = await m.User.findByPk(followingId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existing = await m.Follower.findOne({
      where: {
        follower_id: followerId,
        following_id: followingId,
      },
    });

    if (existing) {
      return res.json({
        message: existing.status === 'pending' ? 'Follow request already sent' : 'Already following',
        status: existing.status,
        data: existing,
      });
    }

    const status = targetUser.is_private ? 'pending' : 'accepted';

    const followRecord = await m.Follower.create({
      follower_id: followerId,
      following_id: followingId,
      status,
    });

    res.status(201).json({
      status,
      message: status === 'pending' ? 'Follow request sent' : 'Following',
      data: followRecord,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function unfollow(req, res) {
  const { followingId } = req.body;
  const followerId = req.user.id;

  try {
    await m.Follower.destroy({
      where: {
        follower_id: followerId,
        following_id: followingId,
      },
    });
    res.json({ message: 'Unfollowed', status: 'none' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function listRequests(req, res) {
  try {
    const requests = await m.Follower.findAll({
      where: {
        following_id: req.user.id,
        status: 'pending',
      },
      order: [['createdAt', 'DESC']],
    });

    const followerIds = [...new Set(requests.map((row) => row.follower_id))];

    const users = followerIds.length
      ? await m.User.findAll({
        where: { id: followerIds },
        attributes: ['id', 'name', 'username', 'image'],
      })
      : [];

    const userById = Object.fromEntries(users.map((user) => [user.id, user]));

    const payload = requests.map((row) => ({
      ...row.toJSON(),
      follower: userById[row.follower_id] || null,
    }));

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function acceptRequest(req, res) {
  const { followerId } = req.body;
  const followingId = req.user.id;

  try {
    const row = await m.Follower.findOne({
      where: {
        follower_id: followerId,
        following_id: followingId,
        status: 'pending',
      },
    });

    if (!row) {
      return res.status(404).json({ error: 'Follow request not found' });
    }

    await row.update({ status: 'accepted' });
    res.json({ message: 'Follow request accepted', status: 'accepted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function rejectRequest(req, res) {
  const { followerId } = req.body;

  try {
    const deleted = await m.Follower.destroy({
      where: {
        follower_id: followerId,
        following_id: req.user.id,
        status: 'pending',
      },
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Follow request not found' });
    }

    res.json({ message: 'Follow request declined' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  follow, unfollow, listRequests, acceptRequest, rejectRequest,
};
