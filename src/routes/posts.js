const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', postController.getPosts);
router.post('/', postController.createPost);
router.post('/:postId/like', postController.toggleLike);
router.get('/leaderboard', postController.getLeaderboard);
router.get('/notes/:userId', postController.getUserNotes);

module.exports = router;
