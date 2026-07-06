const m = require('../models');

async function getFollowStatus(viewerId, ownerId) {
  if (!viewerId || !ownerId) return 'none';
  if (Number(viewerId) === Number(ownerId)) return 'self';

  const row = await m.Follower.findOne({
    where: {
      follower_id: viewerId,
      following_id: ownerId,
    },
  });

  if (!row) return 'none';
  return row.status === 'accepted' ? 'accepted' : 'pending';
}

async function canViewUserContent(viewerId, ownerId) {
  if (!ownerId) return false;
  if (Number(viewerId) === Number(ownerId)) return true;

  const owner = await m.User.findByPk(ownerId, { attributes: ['is_private'] });
  if (!owner?.is_private) return true;

  if (!viewerId) return false;

  const row = await m.Follower.findOne({
    where: {
      follower_id: viewerId,
      following_id: ownerId,
      status: 'accepted',
    },
  });

  return Boolean(row);
}

module.exports = {
  getFollowStatus,
  canViewUserContent,
};
