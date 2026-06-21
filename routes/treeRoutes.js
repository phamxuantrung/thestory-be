const express = require('express');
const router = express.Router();
const { getTree, plantTree, interactTree, reviveTree, addReward, buyItem, usePotion, useProp, restoreStreak, resetStreak, devCheat, sprayPest, pullWeed, harvestStone, useStone } = require('../controllers/treeController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, getTree);
router.post('/plant', protect, plantTree);
router.post('/interact', protect, interactTree);
router.post('/harvest-stone', protect, harvestStone);
router.post('/use-stone', protect, useStone);
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
