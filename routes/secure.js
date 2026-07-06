const express = require('express');
const upload = require('../middleware/upload');
const uploadStory = require('../middleware/uploadStory');

const router = express.Router();
const c = require('../controllers');
const m = require('../middleware');

router.get('/role', c.role.index);
router.get('/activitylog', m.requireAdminOrUser, c.activitylog.index);

router.get('/users/search', m.requireAdminOrUser, c.user.search);
router.get('/users/by-username/:username', m.requireAdminOrUser, c.user.getByUsername);
router.get('/users', m.requireAdmin, c.user.index);
router.get('/user/:id', c.user.getDetails);
router.post('/user/:UserId', c.userUpdate.update);

// Group management
router.get('/groups', m.requireAdminOrUser, c.group.list);
router.post('/groups', m.requireAdminOrUser, c.group.create);
router.get('/groups/slug/:slug', m.requireAdminOrUser, c.group.getBySlug);
router.delete('/groups/:groupId', m.requireAdminOrUser, c.group.destroy);
router.post('/groups/:groupId/join', m.requireAdminOrUser, c.group.join);
router.post('/groups/:groupId/leave', m.requireAdminOrUser, c.group.leave);
router.get('/groups/:groupId/members', m.requireAdminOrUser, c.group.listMembers);
router.get('/groups/:groupId/join-requests', m.requireAdminOrUser, c.group.listJoinRequests);
router.post('/groups/:groupId/join-requests/:userId/accept', m.requireAdminOrUser, c.group.acceptJoinRequest);
router.post('/groups/:groupId/join-requests/:userId/reject', m.requireAdminOrUser, c.group.rejectJoinRequest);
router.post('/groups/:groupId/members/:userId/promote-admin', m.requireAdminOrUser, c.group.promoteToAdmin);
router.post('/groups/:groupId/members/:userId/promote-creator', m.requireAdminOrUser, c.group.promoteToCreator);
router.delete('/groups/:groupId/members/:userId', m.requireAdminOrUser, c.group.removeMember);
router.get('/groups/:groupId/posts', m.requireAdminOrUser, c.group.listPosts);
router.get('/groups/:groupId/posts/pending', m.requireAdminOrUser, c.group.listPendingPosts);
router.post('/groups/:groupId/posts', m.requireAdminOrUser, upload.handlePostMediaUpload, c.group.createPost);
router.post('/groups/:groupId/posts/:postId/approve', m.requireAdminOrUser, c.group.approvePost);
router.post('/groups/:groupId/posts/:postId/reject', m.requireAdminOrUser, c.group.rejectPost);

// Post management
router.get('/feed', m.requireAdminOrUser, c.post.feed);
router.post('/posts', m.requireAdminOrUser, upload.handlePostMediaUpload, c.post.create);
router.put('/posts/:postId', m.requireAdminOrUser, upload.handlePostMediaUpload, c.post.update);
router.delete('/posts/:postId', m.requireAdminOrUser, c.post.destroy);

router.post('/posts/:postId/comments', m.requireAdminOrUser, c.comment.create); // Create a comment on a post
router.post('/posts/:postId/like', m.requireAdminOrUser, c.like.toggleLike); // Like or unlike a post

// Follow management
router.post('/follow', m.requireAdminOrUser, c.follower.follow);
router.post('/unfollow', m.requireAdminOrUser, c.follower.unfollow);
router.get('/follow/requests', m.requireAdminOrUser, c.follower.listRequests);
router.post('/follow/accept', m.requireAdminOrUser, c.follower.acceptRequest);
router.post('/follow/reject', m.requireAdminOrUser, c.follower.rejectRequest);

// Story management (followers-only viewing enforced in controller)
router.get('/stories/feed', m.requireAdminOrUser, c.story.feed);
router.get('/stories/user/:userId', m.requireAdminOrUser, c.story.getUserStories);
router.post('/stories', m.requireAdminOrUser, uploadStory.handleSingleUpload, c.story.create);
router.delete('/stories/:storyId', m.requireAdminOrUser, c.story.destroy);

// Event management
router.post('/events', m.requireAdminOrUser, c.event.createEvent);
router.put('/events/:eventId', m.requireAdminOrUser, c.event.updateEvent);
router.delete('/events/:eventId', m.requireAdminOrUser, c.event.deleteEvent);
router.get('/events/calendar', m.requireAdminOrUser, c.event.getCalendar);
router.get('/events/whatsapp', m.requireAdminOrUser, c.event.getWhatsAppEvents);
router.get('/events', c.event.getEvents);
router.get('/events/:eventId', c.event.getEventById);


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
