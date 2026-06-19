const Message = require('../models/Message');
const User = require('../models/User');
const { cloudinary } = require('../utils/cloudinaryUpload');

// GET /api/chat — Lấy lịch sử tin nhắn (paginated, mới nhất cuối)
const getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (page - 1) * limit;

    const total = await Message.countDocuments();
    const messages = await Message.find()
      .populate('sender', 'displayName gender avatar')
      .populate('replyTo', 'content sender type mediaUrl')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      message: 'OK',
      data: {
        messages,
        pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    console.error('getMessages error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// GET /api/chat/pinned — Lấy tin nhắn đã ghim
const getPinnedMessages = async (req, res) => {
  try {
    const pinned = await Message.find({ isPinned: true })
      .populate('sender', 'displayName gender')
      .sort({ createdAt: -1 })
      .limit(1);
    res.json({ success: true, message: 'OK', data: pinned });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// POST /api/chat — Gửi tin nhắn (REST fallback, chủ yếu dùng socket)
const sendMessage = async (req, res) => {
  try {
    const { content, type = 'text', replyTo } = req.body;
    let mediaUrl = null;
    let mediaPublicId = null;

    if (req.file) {
      mediaUrl = req.file.path;
      mediaPublicId = req.file.filename;
    }

    const message = await Message.create({
      sender: req.user.id,
      content: content || '',
      type: req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : type,
      mediaUrl,
      mediaPublicId,
      replyTo: replyTo || null,
    });

    const populated = await Message.findById(message._id)
      .populate('sender', 'displayName gender avatar')
      .populate('replyTo', 'content sender type mediaUrl');

    res.status(201).json({ success: true, message: 'Đã gửi', data: populated });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// DELETE /api/chat/:id — Xóa tin nhắn
const deleteMessage = async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Không tìm thấy', data: null });

    // Xóa media trên Cloudinary nếu có
    if (msg.mediaPublicId) {
      try {
        await cloudinary.uploader.destroy(msg.mediaPublicId, { resource_type: 'auto' });
      } catch (e) {
        console.warn('Cloudinary delete error:', e.message);
      }
    }

    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// PUT /api/chat/:id/pin — Ghim / bỏ ghim
const togglePin = async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Không tìm thấy', data: null });

    // Bỏ ghim tất cả trước
    await Message.updateMany({ isPinned: true }, { isPinned: false });
    // Ghim cái này (nếu chưa được ghim)
    const wasPinned = msg.isPinned;
    msg.isPinned = !wasPinned;
    await msg.save();

    res.json({ success: true, message: msg.isPinned ? 'Đã ghim' : 'Đã bỏ ghim', data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// PUT /api/chat/:id/react — React emoji
const reactMessage = async (req, res) => {
  try {
    const { emoji } = req.body;
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Không tìm thấy', data: null });

    const userId = req.user.id;
    const existingIdx = msg.reactions.findIndex((r) => r.userId.toString() === userId);

    if (existingIdx > -1) {
      if (msg.reactions[existingIdx].emoji === emoji) {
        // Bỏ react nếu bấm cùng emoji
        msg.reactions.splice(existingIdx, 1);
      } else {
        // Đổi emoji
        msg.reactions[existingIdx].emoji = emoji;
      }
    } else {
      msg.reactions.push({ userId, emoji });
    }
    await msg.save();

    res.json({ success: true, message: 'OK', data: msg.reactions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// PUT /api/chat/seen — Đánh dấu đã đọc
const markSeen = async (req, res) => {
  try {
    await Message.updateMany({ isRead: false, sender: { $ne: req.user.id } }, { isRead: true });
    res.json({ success: true, message: 'Đã đọc', data: null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

module.exports = { getMessages, getPinnedMessages, sendMessage, deleteMessage, togglePin, reactMessage, markSeen };
