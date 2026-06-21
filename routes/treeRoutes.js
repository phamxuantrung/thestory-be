const express = require('express');
const router = express.Router();
const { getTree, interactTree, reviveTree, addReward, buyItem, usePotion, useProp, restoreStreak, resetStreak, devCheat, sprayPest, pullWeed } = require('../controllers/treeController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, getTree);
router.post('/interact', protect, interactTree);
router.post('/revive', protect, reviveTree);
router.post('/reward', protect, addReward);
router.post('/buy-item', protect, buyItem);
router.post('/use-potion', protect, usePotion);
router.post('/use-prop', protect, useProp);
router.post('/restore-streak', protect, restoreStreak);
router.post('/reset-streak', protect, resetStreak);
router.post('/dev-cheat', protect, devCheat);
router.post('/spray-pest', protect, sprayPest);
router.post('/pull-weed', protect, pullWeed);

module.exports = router;
