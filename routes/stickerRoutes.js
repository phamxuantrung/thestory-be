const express = require('express');
const router = express.Router();
const stickerController = require('../controllers/stickerController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadStickerMedia } = require('../utils/cloudinaryUpload');

router.use(protect);

router.post('/', uploadStickerMedia.single('media'), stickerController.uploadSticker);
router.get('/', stickerController.getCustomStickers);
router.delete('/:id', stickerController.deleteSticker);

module.exports = router;
