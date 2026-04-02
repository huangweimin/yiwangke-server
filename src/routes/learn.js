const express = require('express');
const router = express.Router();
const learnController = require('../controllers/learnController');
const authMiddleware = require('../middleware/auth');

router.get('/today-task', authMiddleware, learnController.getTodayTask);
router.post('/review', authMiddleware, learnController.submitReview);
router.post('/new', authMiddleware, learnController.learnNewWord);
router.post('/add-to-review', authMiddleware, learnController.addToReview);
router.get('/stats', authMiddleware, learnController.getStats);

module.exports = router;
