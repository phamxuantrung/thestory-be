const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { protect } = require('../middlewares/authMiddleware');
const multer = require('multer');
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
    folder: 'TheStory_Store',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.use(protect);

// Products
router.get('/partner-products', storeController.getPartnerProducts);
router.get('/my-products', storeController.getMyProducts);
router.post('/products', upload.single('image'), storeController.createProduct);
router.put('/products/:id', upload.single('image'), storeController.updateProduct);
router.delete('/products/:id', storeController.deleteProduct);

// Orders
router.post('/buy', storeController.buyProduct);
router.get('/my-orders', storeController.getMyOrders);
router.get('/partner-orders', storeController.getPartnerOrders);
router.put('/orders/:id/status', storeController.updateOrderStatus);

module.exports = router;
