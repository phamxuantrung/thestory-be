const express = require('express');
const router = express.Router();
const { login, logout, getMe, updateMe, updatePartnerHobbies, uploadAvatar, changePassword } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadAvatarMedia } = require('../utils/cloudinaryUpload');

router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.put('/me/partner-hobbies', protect, updatePartnerHobbies);
router.post('/me/avatar', protect, uploadAvatarMedia.single('avatar'), uploadAvatar);
router.put('/me/password', protect, changePassword);

module.exports = router;
