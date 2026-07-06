const m = require('../models');
const { Op } = require('sequelize');

const ROLES = {
  CREATOR: 'creator',
  ADMIN: 'admin',
  MEMBER: 'member',
};

const STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

const MODERATION = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'group';
}

async function uniqueSlug(name) {
  let base = slugify(name);
  let slug = base;
  let counter = 1;

  // eslint-disable-next-line no-await-in-loop
  while (await m.Group.findOne({ where: { slug } })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}

async function getMembership(groupId, userId) {
  if (!groupId || !userId) return null;
  return m.GroupMember.findOne({
    where: { group_id: groupId, user_id: userId },
  });
}

function isAcceptedMember(member) {
  return Boolean(member && member.status === STATUS.ACCEPTED);
}

function isModerator(member) {
  return isAcceptedMember(member) && [ROLES.CREATOR, ROLES.ADMIN].includes(member.role);
}

function isCreator(member) {
  return isAcceptedMember(member) && member.role === ROLES.CREATOR;
}

async function canViewGroup(group, member) {
  if (!group) return false;
  if (!group.is_private) return true;
  return isAcceptedMember(member);
}

async function countCreators(groupId) {
  return m.GroupMember.count({
    where: {
      group_id: groupId,
      role: ROLES.CREATOR,
      status: STATUS.ACCEPTED,
    },
  });
}

async function getAcceptedMemberUserIds(groupId) {
  const rows = await m.GroupMember.findAll({
    where: { group_id: groupId, status: STATUS.ACCEPTED },
    attributes: ['user_id'],
  });
  return new Set(rows.map((row) => Number(row.user_id)));
}

async function enrichPosts(posts, viewerId = null) {
  const list = Array.isArray(posts) ? posts : [posts];
  if (list.length === 0) return list;

  const groupIds = [...new Set(list.map((p) => p.group_id).filter(Boolean))];
  const pairs = list
    .filter((p) => p.group_id)
    .map((p) => ({ group_id: p.group_id, user_id: Number(p.user_id) }));

  let memberKeys = new Set();
  let moderatorGroupIds = new Set();

  if (pairs.length > 0) {
    const memberships = await m.GroupMember.findAll({
      where: {
        group_id: { [Op.in]: groupIds },
        status: STATUS.ACCEPTED,
      },
      attributes: ['group_id', 'user_id', 'role'],
    });
    memberKeys = new Set(
      memberships.map((row) => `${row.group_id}-${row.user_id}`),
    );

    if (viewerId) {
      moderatorGroupIds = new Set(
        memberships
          .filter((row) => Number(row.user_id) === Number(viewerId)
            && [ROLES.CREATOR, ROLES.ADMIN].includes(row.role))
          .map((row) => Number(row.group_id)),
      );
    }
  }

  return list.map((post) => {
    const json = typeof post.toJSON === 'function' ? post.toJSON() : { ...post };
    if (json.group_id) {
      json.author_is_member = memberKeys.has(`${json.group_id}-${Number(json.user_id)}`);
      json.viewer_can_moderate = viewerId
        ? moderatorGroupIds.has(Number(json.group_id))
        : false;
    } else {
      json.author_is_member = true;
      json.viewer_can_moderate = false;
    }
    return json;
  });
}

async function canModerateGroupPost(post, userId) {
  if (!post?.group_id || !userId) return false;
  const membership = await getMembership(post.group_id, userId);
  return isModerator(membership);
}

async function canDeletePost(post, userId) {
  if (!post || !userId) return false;
  if (Number(post.user_id) === Number(userId)) return true;
  return canModerateGroupPost(post, userId);
}

function serializeGroup(group, extras = {}) {
  const json = typeof group.toJSON === 'function' ? group.toJSON() : { ...group };
  return { ...json, ...extras };
}

module.exports = {
  ROLES,
  STATUS,
  MODERATION,
  slugify,
  uniqueSlug,
  getMembership,
  isAcceptedMember,
  isModerator,
  isCreator,
  canViewGroup,
  countCreators,
  getAcceptedMemberUserIds,
  enrichPosts,
  canModerateGroupPost,
  canDeletePost,
  serializeGroup,
};
