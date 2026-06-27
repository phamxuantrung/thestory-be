const express = require('express');
const router = express.Router();
const { getStatus, spinWheel } = require('../controllers/luckyWheelController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/status', protect, getStatus);
router.post('/spin', protect, spinWheel);

module.exports = router;
