const express = require('express');

const router = express.Router();
const c = require('../controllers');

// Route Open

router.get('/', c.general.index);
router.get('/staticdata', c.general.staticdata);
router.get('/whatsapp-bot', c.general.whatsappBot);
router.post('/login', c.auth.login);
router.post('/signup', c.auth.signup);
router.get('/verify-email', c.auth.verifyEmail);
// router.post('/forgot-password', c.user.passwordForgot);
// Route to request password reset
router.post('/request-password-reset', c.auth.requestPasswordReset);

// Route to reset password
router.post('/reset-password', c.auth.passwordResetTokenValidation, c.auth.passwordReset);

// Public Post and Comment Routes
router.get('/posts', c.post.index); // Get all posts
router.get('/posts/:postId', c.post.getDetails); // Get post details by ID
router.get('/posts/:postId/comments', c.comment.index); // Get comments for a post
router.get('/posts/:postId/likes', c.like.index); // Get users who liked a post

module.exports = router;
