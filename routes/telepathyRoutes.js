const express = require('express');
const router = express.Router();
const { getTodayQuiz, answerQuiz } = require('../controllers/telepathyController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/today', protect, getTodayQuiz);
router.post('/answer', protect, answerQuiz);

module.exports = router;
