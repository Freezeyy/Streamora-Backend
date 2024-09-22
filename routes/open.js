const express = require('express');

const router = express.Router();
const c = require('../controllers');

// Route Open

router.get('/', c.general.index);
router.get('/staticdata', c.general.staticdata);
router.post('/login', c.auth.login);
router.post('/signup', c.auth.signup);
router.get('/verify-email', c.auth.verifyEmail);
router.post('/forgot-password', c.user.passwordForgot);
router.post('/verify-reset-password-token', c.auth.passwordResetTokenValidation);
router.post('/reset-password', c.auth.passwordReset);

// Public Post and Comment Routes
router.get('/posts', c.post.index); // Get all posts
router.get('/posts/:postId', c.post.getDetails); // Get post details by ID
router.get('/posts/:postId/comments', c.comment.index); // Get comments for a post

module.exports = router;
