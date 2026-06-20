const FutureLetter = require('../models/FutureLetter');
const User = require('../models/User');

// POST /api/future-letters — Tạo một lá thư mới
const createLetter = async (req, res) => {
  try {
    const { content, unlockDate } = req.body;
    
    if (!content || !unlockDate) {
      return res.status(400).json({ success: false, message: 'Nội dung và ngày mở là bắt buộc', data: null });
    }

    const user = await User.findById(req.user.id);
    if (!user.partnerId) {
      return res.status(400).json({ success: false, message: 'Bạn chưa kết nối với người ấy', data: null });
    }

    const unlock = new Date(unlockDate);
    if (unlock <= new Date()) {
      return res.status(400).json({ success: false, message: 'Ngày mở phải ở trong tương lai', data: null });
    }

    const letter = await FutureLetter.create({
      sender: req.user.id,
      receiver: user.partnerId,
      content,
      unlockDate: unlock,
    });

    res.status(201).json({ success: true, message: 'Đã gửi lá thư đến tương lai! 💌', data: letter });
  } catch (error) {
    console.error('createLetter error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// GET /api/future-letters — Lấy danh sách thư của cặp đôi
const getLetters = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.partnerId) {
       return res.status(200).json({ success: true, message: 'OK', data: [] });
    }

    // Lấy thư do mình gửi hoặc mình nhận
    const letters = await FutureLetter.find({
      $or: [
        { sender: req.user.id, receiver: user.partnerId },
        { sender: user.partnerId, receiver: req.user.id }
      ]
    }).populate('sender', 'displayName avatar').sort('-createdAt');

    const now = new Date();
    
    // Cập nhật trạng thái mở khóa và ẩn nội dung nếu chưa tới ngày
    const processedLetters = await Promise.all(letters.map(async (letter) => {
      let isUnlocked = letter.isUnlocked;
      
      if (!isUnlocked && letter.unlockDate <= now) {
        letter.isUnlocked = true;
        await letter.save();
        isUnlocked = true;
      }
      
      const letterObj = letter.toObject();
      
      // Nếu chưa được mở, ẩn nội dung đối với người NHẬN. Người gửi có thể xem nội dung mình đã viết để chỉnh sửa.
      if (!isUnlocked && String(letter.sender._id) !== String(req.user.id)) {
         letterObj.content = 'Nội dung lá thư đang bị khóa 🔒';
      }
      
      return letterObj;
    }));

    res.status(200).json({ success: true, message: 'OK', data: processedLetters });
  } catch (error) {
    console.error('getLetters error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// PUT /api/future-letters/:id — Sửa thư
const updateLetter = async (req, res) => {
  try {
    const { content, unlockDate } = req.body;
    const letter = await FutureLetter.findOne({ _id: req.params.id, sender: req.user.id });

    if (!letter) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thư hoặc bạn không có quyền sửa', data: null });
    }

    if (letter.isUnlocked) {
      return res.status(400).json({ success: false, message: 'Không thể sửa thư đã mở', data: null });
    }

    if (content) letter.content = content;
    if (unlockDate) letter.unlockDate = new Date(unlockDate);

    await letter.save();

    res.status(200).json({ success: true, message: 'Đã cập nhật thư', data: letter });
  } catch (error) {
    console.error('updateLetter error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// DELETE /api/future-letters/:id — Xóa thư
const deleteLetter = async (req, res) => {
  try {
    const letter = await FutureLetter.findOneAndDelete({ _id: req.params.id, sender: req.user.id });

    if (!letter) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thư hoặc bạn không có quyền xóa', data: null });
    }

    res.status(200).json({ success: true, message: 'Đã xóa thư', data: null });
  } catch (error) {
    console.error('deleteLetter error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

module.exports = { createLetter, getLetters, updateLetter, deleteLetter };
