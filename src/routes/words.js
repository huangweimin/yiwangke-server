const express = require('express');
const router = express.Router();
const wordController = require('../controllers/wordController');
const authMiddleware = require('../middleware/auth');

router.get('/', wordController.getWords);
router.get('/roots', wordController.getRoots);
router.get('/:id', authMiddleware, wordController.getWord);

module.exports = router;
