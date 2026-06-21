const express = require('express');
const router = express.Router();
const { getActiveQuests, getQuestHistory, generateQuests, acceptQuest, completeQuest } = require('../controllers/questController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', getActiveQuests);
router.get('/history', getQuestHistory);
router.post('/generate', generateQuests);
router.post('/:id/accept', acceptQuest);
router.post('/:id/complete', completeQuest);

module.exports = router;
