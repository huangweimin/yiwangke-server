const express = require('express');
const router = express.Router();
const rootController = require('../controllers/rootController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', rootController.getRoots);
router.get('/:root', rootController.getRootDetail);

module.exports = router;
