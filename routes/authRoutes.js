const express = require('express');
const router = express.Router();
const { login, logout, getMe, updateMe, updatePartnerHobbies, subscribePush } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.put('/me/partner-hobbies', protect, updatePartnerHobbies);
router.post('/push-subscription', protect, subscribePush);

module.exports = router;
