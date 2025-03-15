const express = require('express');
const upload = require('../middleware/upload');

const router = express.Router();
const c = require('../controllers');
const m = require('../middleware');

router.get('/role', c.role.index);
router.get('/activitylog', m.requireAdminOrUser, c.activitylog.index);

router.get('/users', m.requireAdmin, c.user.index);
router.get('/user/:id', c.user.getDetails);
router.post('/user/:UserId', c.userUpdate.update);

// Post management
router.post('/posts', upload.array('media', 10), m.requireAdminOrUser, c.post.create);
router.put('/posts/:postId', m.requireAdminOrUser, upload.array('media', 10), c.post.update);

router.post('/posts/:postId/comments', m.requireAdminOrUser, c.comment.create); // Create a comment on a post
router.post('/posts/:postId/like', m.requireAdminOrUser, c.like.toggleLike); // Like or unlike a post

// Follow management
router.post('/follow', m.requireAdminOrUser, c.follower.follow); // Follow a user
router.post('/unfollow', m.requireAdminOrUser, c.follower.unfollow); // Unfollow a user

// Let's say the route below is very sensitive and we want only authorized users to have access
// router.get('/nationalgps', c.nationalgps.index);
// router.post('/nationalgps', c.nationalgps.saveorupdate);
// router.get('/nationalneb', c.nationalneb.index);
// router.post('/nationalneb', c.nationalneb.saveorupdate);

// router.get('/solution-preset-names', m.requireAdmin, c.solutionpreset.presets);
// router.get('/solution-presets/:preset_name?', m.requireAdmin, c.solutionpreset.index);
// router.post('/solution-preset/:id', m.requireAdmin, c.solutionpreset.update);
// router.delete('/solution-preset/:id', m.requireAdmin, c.solutionpreset.destroy);
// router.post('/solution-preset', m.requireAdmin, c.solutionpreset.create);

module.exports = router;
