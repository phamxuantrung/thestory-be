const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { uploadChatMedia } = require('../utils/cloudinaryUpload');
const {
  getMessages,
  getPinnedMessages,
  sendMessage,
  deleteMessage,
  togglePin,
  reactMessage,
  markSeen,
} = require('../controllers/chatController');

router.get('/', protect, getMessages);
router.get('/pinned', protect, getPinnedMessages);
router.post('/', protect, uploadChatMedia.single('media'), sendMessage);
router.delete('/:id', protect, deleteMessage);
router.put('/seen', protect, markSeen);
router.put('/:id/pin', protect, togglePin);
router.put('/:id/react', protect, reactMessage);

module.exports = router;
