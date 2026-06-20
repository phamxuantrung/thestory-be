const express = require('express');
const router = express.Router();
const { logMood, getMoodStats } = require('../controllers/moodController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, logMood);
router.get('/stats', protect, getMoodStats);

module.exports = router;
