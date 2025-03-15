const moment = require('moment');
const jwt = require('jsonwebtoken');
const helper = require('../helper');
const { encoderBase64, removeTrailingSymbolFromUrl } = require('../helper');
const m = require('../models');
const svc = require('../services');

async function index(req, res) {
  const {
    where, page, perpage, Sequelize, offset, order,
  } = helper.queryParameters({ req, search_columns: ['name', 'email'] });

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

// function getDetails(req, res) {
//   const id = (req.query.id) ? req.query.id : req.user.id;
//   if (req.user.RoleId === 1 || req.user.id === parseInt(id, 10)) {
//     m.User.findOne({
//       attributes: { exclude: ['password', 'updatedAt', 'reset_token'] },
//       where: { id },
//       include: [{ model: m.Role, attributes: ['id', 'name'] }, { model: m.Organization, attributes: ['id', 'name'] }],
//     })
//       .then((data) => res.json({ data }))
//       .catch((e) => res.status(500).send({ error: e }));
//   } else {
//     res.status(403).send({ error: 'access denied' });
//   }
// }

async function getDetails(req, res) {
  const id = req.params.id || req.user.id; // Get user ID from route parameters or default to logged-in user
  const includes = [];

  // Check if 'with' query parameter exists and includes 'followers'
  if (req.query.with && req.query.with.includes('followers')) {
    includes.push({
      model: m.User,
      as: 'followers', // Alias for followers based on your associations
      attributes: ['id', 'name'], // Include only the 'id' and 'name' attributes of followers
      through: { attributes: [] }, // Exclude join table attributes
    });
  }

  // Check if 'with' query parameter exists and includes 'followings'
  if (req.query.with && req.query.with.includes('followings')) {
    includes.push({
      model: m.User,
      as: 'following', // Alias for following based on your associations
      attributes: ['id', 'name'], // Include only the 'id' and 'name' attributes of followings
      through: { attributes: [] }, // Exclude join table attributes
    });
  }

  // Check if 'with' query parameter exists and includes 'posts'
  if (req.query.with && req.query.with.includes('posts')) {
    includes.push({
      model: m.Post,
      as: 'posts',
      attributes: ['id', 'content', 'createdAt'], // Specify necessary post attributes
      include: [
        { model: m.Media, as: 'media', attributes: ['media_path'] }, // Include media associated with the post
        {
          model: m.Comment,
          as: 'comments',
          attributes: ['id', 'comment', 'user_id'],
          include: [{ model: m.User, as: 'user', attributes: ['id', 'name'] }], // Include comment authors
        },
        { model: m.Like, as: 'likes', attributes: ['user_id'] }, // Include likes
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

    res.json(user);
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
  getDetails, passwordForgot, verifyUser, index,
};
