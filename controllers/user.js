const moment = require('moment');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const g = require('../helper/group');
const helper = require('../helper');
const { canViewUserContent, getFollowStatus } = require('../helper/privacy');
const { encoderBase64, removeTrailingSymbolFromUrl } = require('../helper');
const m = require('../models');
const svc = require('../services');

async function index(req, res) {
  const {
    where, page, perpage, Sequelize, offset, order,
  } = helper.queryParameters({ req, search_columns: ['name', 'email', 'username'] });

  const { verified } = req.query;

  if (verified === '1') {
    where.verifiedAt = { [Sequelize.Op.ne]: null };
  } else if (verified === '0') {
    where.verifiedAt = null;
  }

  try {
    const data = await m.User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      limit: perpage,
      offset,
      ...order,
    });
    res.json({
      data: data.rows, page, perpage, total: data.count,
    });
  } catch (error) {
    res.status(500).json({ error });
  }
}

async function search(req, res) {
  const { keyword, mention, scope } = req.query;
  const isMention = mention === '1' || mention === 'true';

  if ((!keyword || !keyword.trim()) && !isMention) {
    return res.json({ data: [] });
  }

  const trimmed = (keyword || '').trim();
  const userAttributes = ['id', 'name', 'email', 'username', 'image'];

  try {
    if (!trimmed && isMention && scope === 'following') {
      const user = await m.User.findByPk(req.user.id, {
        include: [{
          model: m.User,
          as: 'following',
          attributes: userAttributes,
          through: { where: { status: 'accepted' }, attributes: [] },
        }],
      });

      const users = (user?.following || [])
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .slice(0, 10);

      return res.json({ data: users });
    }

    if (!trimmed && isMention) {
      return res.json({ data: [] });
    }

    const {
      where, Sequelize,
    } = helper.queryParameters({
      req: { query: { keyword: trimmed, perpage: 15 } },
      search_columns: ['name', 'email', 'username'],
    });

    where.id = { [Sequelize.Op.ne]: req.user.id };

    const users = await m.User.findAll({
      where,
      attributes: userAttributes,
      limit: 15,
      order: [['name', 'ASC']],
    });

    res.json({ data: users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getByUsername(req, res) {
  const username = (req.params.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  try {
    const user = await m.User.findOne({
      where: { username },
      attributes: ['id', 'name', 'username', 'image', 'bio'],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ data: user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getDetails(req, res) {
  const id = req.params.id || req.user.id;
  const includes = [];

  if (req.query.with && req.query.with.includes('followers')) {
    includes.push({
      model: m.User,
      as: 'followers',
      attributes: ['id', 'name'],
      through: { where: { status: 'accepted' }, attributes: [] },
    });
  }

  if (req.query.with && req.query.with.includes('followings')) {
    includes.push({
      model: m.User,
      as: 'following',
      attributes: ['id', 'name'],
      through: { where: { status: 'accepted' }, attributes: [] },
    });
  }

  if (req.query.with && req.query.with.includes('posts')) {
    includes.push({
      model: m.Post,
      as: 'posts',
      separate: true,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'content', 'createdAt', 'user_id', 'group_id', 'moderation_status'],
      include: [
        { model: m.Media, as: 'media', attributes: ['media_path', 'file_name'] },
        { model: m.Group, as: 'group', attributes: ['id', 'name', 'slug'] },
        {
          model: m.Comment,
          as: 'comments',
          attributes: ['id', 'comment', 'user_id'],
          include: [{ model: m.User, as: 'user', attributes: ['id', 'name'] }],
        },
        { model: m.Like, as: 'likes', attributes: ['user_id'] },
      ],
    });
  }

  try {
    const user = await m.User.findOne({
      where: { id },
      attributes: { exclude: ['password', 'updatedAt', 'reset_token'] },
      include: includes,
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const viewerId = req.user?.id;
    const canView = await canViewUserContent(viewerId, id);
    const viewerFollowStatus = await getFollowStatus(viewerId, id);

    const payload = user.toJSON();
    payload.viewerFollowStatus = viewerFollowStatus;
    payload.canViewContent = canView;

    if (!canView) {
      delete payload.posts;
    } else if (payload.posts) {
      payload.posts = payload.posts.filter((post) => {
        if (!post.group_id) return true;
        if (post.moderation_status === g.MODERATION.APPROVED) return true;
        return Number(post.user_id) === Number(viewerId);
      });
      payload.posts = await g.enrichPosts(payload.posts, viewerId);
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error });
  }
}

function passwordForgot(req, res) {
  m.User.findOne({ where: { email: req.body.email } })
    .then(async (user) => {
      if (!user) {
        res.status(404).send({ data: 'user not found' });
        return;
      }

      const today_crypt = encoderBase64(moment().unix() + 86400000);
      const content = {
        uid: encoderBase64(user.id),
        token: today_crypt,
      };

      const token = jwt.sign(content, process.env.PROJECT_JWT_SECRET);
      await user.update({ reset_token: token });
      const url = `${removeTrailingSymbolFromUrl(req.body.redirect_url)}?token=${token}`;

      svc.sendMailForgotPassword(url, user);
      res.send({ data: 'successfuly request for password reset' });
    })
    .catch((e) => res.status(500).send({ error: e }));
}

function verifyUser(req, res) {
  m.User.findOne({ where: { id: req.body.id } })
    .then((user) => {
      if (!user) {
        res.status(404).send({ data: 'user not found' });
        return;
      }
      user.update({ verifiedAt: moment().format('YYYY-MM-DD HH:mm:ss') });
      res.json({ status: 'approved' });
    })
    .catch((e) => res.status(500).send({ error: e }));
}

module.exports = {
  getDetails, getByUsername, passwordForgot, verifyUser, index, search,
};
