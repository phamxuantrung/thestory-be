const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const chatMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'TheStory_Chat',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov'],
    resource_type: 'auto',
  },
});

const uploadChatMedia = multer({
  storage: chatMediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const stickerMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'TheStory_Stickers',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    resource_type: 'auto',
  },
});

const uploadStickerMedia = multer({
  storage: stickerMediaStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = { cloudinary, uploadChatMedia, uploadStickerMedia };
