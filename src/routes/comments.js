const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/:postId', commentController.getComments);
router.post('/:postId', commentController.addComment);
router.delete('/:commentId', commentController.deleteComment);

module.exports = router;
