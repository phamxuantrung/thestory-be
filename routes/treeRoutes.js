const express = require('express');
const router = express.Router();
const { getTree, interactTree, reviveTree, addFertilizer } = require('../controllers/treeController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, getTree);
router.post('/interact', protect, interactTree);
router.post('/revive', protect, reviveTree);
router.post('/add-fertilizer', protect, addFertilizer);

module.exports = router;
