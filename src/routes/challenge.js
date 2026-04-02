const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', challengeController.getChallenges);
router.post('/checkin', challengeController.checkin);
router.get('/status', challengeController.getTodayStatus);
router.get('/records', challengeController.getCheckinRecords);

module.exports = router;
