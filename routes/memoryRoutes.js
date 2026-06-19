const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middlewares/authMiddleware');
const {
  getMemories,
  getMemoryById,
  createMemory,
  updateMemory,
  deleteMemory,
  toggleLike,
} = require('../controllers/memoryController');

const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'TheStory_Memories',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.get('/', protect, getMemories);
router.get('/:id', protect, getMemoryById);
router.post('/', protect, upload.array('images', 10), createMemory);
router.put('/:id', protect, updateMemory);
router.delete('/:id', protect, deleteMemory);
router.post('/:id/like', protect, toggleLike);

module.exports = router;
