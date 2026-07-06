const path = require('path');
const { Op } = require('sequelize');
const m = require('../models');
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
    { model: m.User, attributes: ['id', 'name', 'image', 'username'], as: 'user' },
    { model: m.Media, as: 'media', attributes: MEDIA_ATTRIBUTES },
    { model: m.Group, as: 'group', attributes: ['id', 'name', 'slug', 'is_private'] },
  ];

  if (req?.query?.with?.includes('comments')) {
    includes.push({
      model: m.Comment,
      as: 'comments',
      include: [{ model: m.User, as: 'user', attributes: ['id', 'name', 'image'] }],
    });
  }

  if (req?.query?.with?.includes('likes')) {
    includes.push({ model: m.Like, as: 'likes', attributes: ['user_id'] });
  }

  return includes;
}

async function loadGroupById(groupId) {
  return m.Group.findByPk(groupId);
}

async function loadGroupBySlug(slug) {
  return m.Group.findOne({ where: { slug } });
}

async function memberCount(groupId) {
  return m.GroupMember.count({
    where: { group_id: groupId, status: g.STATUS.ACCEPTED },
  });
}

async function buildGroupPayload(group, viewerId) {
  const membership = await g.getMembership(group.id, viewerId);
  const count = await memberCount(group.id);
  const creatorCount = await g.countCreators(group.id);

  return g.serializeGroup(group, {
    member_count: count,
    creator_count: creatorCount,
    membership: membership ? {
      role: membership.role,
      status: membership.status,
    } : null,
    viewer_can_view: await g.canViewGroup(group, membership),
    viewer_is_moderator: g.isModerator(membership),
    viewer_is_creator: g.isCreator(membership),
  });
}

async function list(req, res) {
  try {
    const viewerId = req.user.id;
    const { mine, discover } = req.query;

    if (mine === '1') {
      const memberships = await m.GroupMember.findAll({
        where: { user_id: viewerId, status: g.STATUS.ACCEPTED },
        attributes: ['group_id'],
      });
      const groupIds = memberships.map((row) => row.group_id);
      const groups = groupIds.length
        ? await m.Group.findAll({ where: { id: groupIds }, order: [['name', 'ASC']] })
        : [];
      const payload = await Promise.all(groups.map((group) => buildGroupPayload(group, viewerId)));
      return res.json(payload);
    }

    const where = {};
    if (discover === '1') {
      where.is_private = false;
    }

    const groups = await m.Group.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: discover === '1' ? 50 : 100,
    });

    const payload = await Promise.all(groups.map((group) => buildGroupPayload(group, viewerId)));
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function create(req, res) {
  try {
    const { name, description, is_private: isPrivate } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const slug = await g.uniqueSlug(name);
    const group = await m.Group.create({
      name: String(name).trim(),
      slug,
      description: description ? String(description).trim() : null,
      is_private: Boolean(isPrivate),
      created_by: req.user.id,
    });

    await m.GroupMember.create({
      group_id: group.id,
      user_id: req.user.id,
      role: g.ROLES.CREATOR,
      status: g.STATUS.ACCEPTED,
    });

    res.status(201).json(await buildGroupPayload(group, req.user.id));
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function getBySlug(req, res) {
  try {
    const group = await loadGroupBySlug(req.params.slug);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const payload = await buildGroupPayload(group, req.user.id);
    if (!payload.viewer_can_view) {
      return res.status(403).json({
        error: 'This is a private group',
        group: {
          id: group.id,
          name: group.name,
          slug: group.slug,
          is_private: group.is_private,
          membership: payload.membership,
        },
      });
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function destroy(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await g.getMembership(group.id, req.user.id);
    if (!g.isCreator(membership)) {
      return res.status(403).json({ error: 'Only creators can delete this group' });
    }

    const posts = await m.Post.findAll({ where: { group_id: group.id }, attributes: ['id'] });
    const postIds = posts.map((p) => p.id);

    if (postIds.length > 0) {
      await m.Comment.destroy({ where: { post_id: postIds } });
      await m.Like.destroy({ where: { post_id: postIds } });
      await m.Media.destroy({ where: { post_id: postIds } });
      await m.Post.destroy({ where: { group_id: group.id } });
    }

    await m.GroupMember.destroy({ where: { group_id: group.id } });
    await group.destroy();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function join(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const existing = await g.getMembership(group.id, req.user.id);
    if (existing) {
      if (existing.status === g.STATUS.ACCEPTED) {
        return res.json({ message: 'Already a member', membership: existing });
      }
      if (existing.status === g.STATUS.PENDING) {
        return res.json({ message: 'Join request already pending', membership: existing });
      }
      await existing.destroy();
    }

    const status = group.is_private ? g.STATUS.PENDING : g.STATUS.ACCEPTED;
    const membership = await m.GroupMember.create({
      group_id: group.id,
      user_id: req.user.id,
      role: g.ROLES.MEMBER,
      status,
    });

    res.status(201).json({
      message: status === g.STATUS.PENDING ? 'Join request sent' : 'Joined group',
      membership,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function leave(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await g.getMembership(group.id, req.user.id);
    if (!membership || membership.status !== g.STATUS.ACCEPTED) {
      return res.status(400).json({ error: 'You are not a member of this group' });
    }

    if (g.isCreator(membership)) {
      const creators = await g.countCreators(group.id);
      if (creators <= 1) {
        return res.status(400).json({
          error: 'Promote at least one other admin to creator before leaving',
        });
      }
    }

    await membership.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function listMembers(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const viewerMembership = await g.getMembership(group.id, req.user.id);
    if (!await g.canViewGroup(group, viewerMembership)) {
      return res.status(403).json({ error: 'You cannot view members of this group' });
    }

    const members = await m.GroupMember.findAll({
      where: { group_id: group.id, status: g.STATUS.ACCEPTED },
      include: [{ model: m.User, as: 'user', attributes: ['id', 'name', 'username', 'image'] }],
      order: [['createdAt', 'ASC']],
    });

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function listJoinRequests(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await g.getMembership(group.id, req.user.id);
    if (!g.isModerator(membership)) {
      return res.status(403).json({ error: 'Only admins can view join requests' });
    }

    const requests = await m.GroupMember.findAll({
      where: { group_id: group.id, status: g.STATUS.PENDING },
      include: [{ model: m.User, as: 'user', attributes: ['id', 'name', 'username', 'image'] }],
      order: [['createdAt', 'DESC']],
    });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function acceptJoinRequest(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await g.getMembership(group.id, req.user.id);
    if (!g.isModerator(membership)) {
      return res.status(403).json({ error: 'Only admins can accept join requests' });
    }

    const row = await m.GroupMember.findOne({
      where: {
        group_id: group.id,
        user_id: req.params.userId,
        status: g.STATUS.PENDING,
      },
    });

    if (!row) return res.status(404).json({ error: 'Join request not found' });

    await row.update({ status: g.STATUS.ACCEPTED });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function rejectJoinRequest(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await g.getMembership(group.id, req.user.id);
    if (!g.isModerator(membership)) {
      return res.status(403).json({ error: 'Only admins can reject join requests' });
    }

    const deleted = await m.GroupMember.destroy({
      where: {
        group_id: group.id,
        user_id: req.params.userId,
        status: g.STATUS.PENDING,
      },
    });

    if (!deleted) return res.status(404).json({ error: 'Join request not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function promoteToAdmin(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const actor = await g.getMembership(group.id, req.user.id);
    if (!g.isCreator(actor)) {
      return res.status(403).json({ error: 'Only creators can promote to admin' });
    }

    const target = await m.GroupMember.findOne({
      where: {
        group_id: group.id,
        user_id: req.params.userId,
        status: g.STATUS.ACCEPTED,
        role: g.ROLES.MEMBER,
      },
    });

    if (!target) return res.status(404).json({ error: 'Member not found' });

    await target.update({ role: g.ROLES.ADMIN });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function promoteToCreator(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const actor = await g.getMembership(group.id, req.user.id);
    if (!g.isCreator(actor)) {
      return res.status(403).json({ error: 'Only creators can promote to creator' });
    }

    const target = await m.GroupMember.findOne({
      where: {
        group_id: group.id,
        user_id: req.params.userId,
        status: g.STATUS.ACCEPTED,
        role: { [Op.in]: [g.ROLES.ADMIN, g.ROLES.MEMBER] },
      },
    });

    if (!target) return res.status(404).json({ error: 'Member not found' });

    await target.update({ role: g.ROLES.CREATOR });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function removeMember(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const actor = await g.getMembership(group.id, req.user.id);
    if (!g.isModerator(actor)) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    const target = await m.GroupMember.findOne({
      where: { group_id: group.id, user_id: req.params.userId, status: g.STATUS.ACCEPTED },
    });

    if (!target) return res.status(404).json({ error: 'Member not found' });

    if (g.isCreator(target) && !g.isCreator(actor)) {
      return res.status(403).json({ error: 'Admins cannot remove creators' });
    }

    if ([g.ROLES.ADMIN, g.ROLES.CREATOR].includes(target.role) && !g.isCreator(actor)) {
      return res.status(403).json({ error: 'Admins cannot remove other admins or creators' });
    }

    if (Number(req.params.userId) === Number(req.user.id) && g.isCreator(target)) {
      const creators = await g.countCreators(group.id);
      if (creators <= 1) {
        return res.status(400).json({
          error: 'Promote another creator before leaving',
        });
      }
    }

    await target.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function listPosts(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await g.getMembership(group.id, req.user.id);
    if (!await g.canViewGroup(group, membership)) {
      return res.status(403).json({ error: 'You cannot view posts in this group' });
    }

    const viewerId = req.user.id;
    const isMod = g.isModerator(membership);

    const where = { group_id: group.id };
    if (!isMod) {
      where[Op.or] = [
        { moderation_status: g.MODERATION.APPROVED },
        { user_id: viewerId },
      ];
    }

    const posts = await m.Post.findAll({
      where,
      include: buildPostIncludes(req),
      order: [['createdAt', 'DESC']],
    });

    const enriched = await g.enrichPosts(posts, req.user.id);
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function listPendingPosts(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await g.getMembership(group.id, req.user.id);
    if (!g.isModerator(membership)) {
      return res.status(403).json({ error: 'Only admins can view pending posts' });
    }

    const posts = await m.Post.findAll({
      where: { group_id: group.id, moderation_status: g.MODERATION.PENDING },
      include: buildPostIncludes(req),
      order: [['createdAt', 'ASC']],
    });

    const enriched = await g.enrichPosts(posts, req.user.id);
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function createPost(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await g.getMembership(group.id, req.user.id);
    if (!g.isAcceptedMember(membership)) {
      return res.status(403).json({ error: 'You must be a member to post in this group' });
    }

    const { content } = req.body;
    if (!content?.trim() && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'Post content or media is required' });
    }

    const autoApprove = g.isModerator(membership);
    const post = await m.Post.create({
      user_id: req.user.id,
      content: content || '',
      group_id: group.id,
      moderation_status: autoApprove ? g.MODERATION.APPROVED : g.MODERATION.PENDING,
      moderated_by: autoApprove ? req.user.id : null,
      moderated_at: autoApprove ? new Date() : null,
    });

    if (req.files?.length > 0) {
      await Promise.all(req.files.map((file) => buildMediaRecord(file, post.id)));
    }

    const postWithRelations = await m.Post.findByPk(post.id, {
      include: buildPostIncludes(req),
    });
    const [enrichedPost] = await g.enrichPosts(postWithRelations, req.user.id);
    res.status(201).json(enrichedPost);
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function approvePost(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await g.getMembership(group.id, req.user.id);
    if (!g.isModerator(membership)) {
      return res.status(403).json({ error: 'Only admins can approve posts' });
    }

    const post = await m.Post.findOne({
      where: { id: req.params.postId, group_id: group.id },
    });

    if (!post) return res.status(404).json({ error: 'Post not found' });

    await post.update({
      moderation_status: g.MODERATION.APPROVED,
      moderated_by: req.user.id,
      moderated_at: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

async function rejectPost(req, res) {
  try {
    const group = await loadGroupById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const membership = await g.getMembership(group.id, req.user.id);
    if (!g.isModerator(membership)) {
      return res.status(403).json({ error: 'Only admins can reject posts' });
    }

    const post = await m.Post.findOne({
      where: { id: req.params.postId, group_id: group.id },
    });

    if (!post) return res.status(404).json({ error: 'Post not found' });

    await post.update({
      moderation_status: g.MODERATION.REJECTED,
      moderated_by: req.user.id,
      moderated_at: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message || error });
  }
}

module.exports = {
  list,
  create,
  getBySlug,
  destroy,
  join,
  leave,
  listMembers,
  listJoinRequests,
  acceptJoinRequest,
  rejectJoinRequest,
  promoteToAdmin,
  promoteToCreator,
  removeMember,
  listPosts,
  listPendingPosts,
  createPost,
  approvePost,
  rejectPost,
  buildPostIncludes,
  enrichPosts: g.enrichPosts,
};
