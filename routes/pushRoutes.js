const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const User = require('../models/User');

// GET /api/push/vapid-public-key — Trả về VAPID public key cho frontend
router.get('/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    data: { publicKey: process.env.VAPID_PUBLIC_KEY },
    message: '',
  });
});

// POST /api/push/subscribe — Lưu subscription của thiết bị
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'Subscription không hợp lệ', data: null });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng', data: null });

    // Tránh trùng lặp endpoint
    const alreadyExists = user.pushSubscriptions.some(
      (sub) => sub.endpoint === subscription.endpoint
    );

    if (!alreadyExists) {
      user.pushSubscriptions.push(subscription);
      await user.save();
    }

    res.json({ success: true, message: 'Đã đăng ký nhận thông báo', data: null });
  } catch (err) {
    console.error('push subscribe error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
});

// DELETE /api/push/unsubscribe — Xoá subscription của thiết bị
router.delete('/unsubscribe', protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng', data: null });

    user.pushSubscriptions = user.pushSubscriptions.filter(
      (sub) => sub.endpoint !== endpoint
    );
    await user.save();

    res.json({ success: true, message: 'Đã huỷ đăng ký thông báo', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
});

module.exports = router;
