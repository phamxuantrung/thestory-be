const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const heartController = require('../controllers/heartController');

// Điểm danh
router.get('/checkin', protect, heartController.getCheckin);
router.post('/checkin', protect, heartController.doCheckin);

// Nhiệm vụ Heart
router.get('/tasks', protect, heartController.getTasks);
router.post('/tasks/:taskId/verify', protect, heartController.verifyTask);
router.post('/tasks/:taskId/complete', protect, heartController.completeTask);

module.exports = router;
