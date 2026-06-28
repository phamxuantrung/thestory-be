const express = require('express');
const router = express.Router();
const { getTodayNumerology } = require('../controllers/numerologyController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/today', protect, getTodayNumerology);

module.exports = router;
