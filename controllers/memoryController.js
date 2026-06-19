const Memory = require('../models/Memory');
const path = require('path');
const fs = require('fs');

// GET /api/memories — Lấy tất cả kỷ niệm của couple
const getMemories = async (req, res) => {
  try {
    const { category, mood, sort = '-createdAt', page = 1, limit = 20 } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (mood) filter.mood = mood;

    const memories = await Memory.find(filter)
      .populate('createdBy', 'displayName gender avatar')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Memory.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: 'OK',
      data: {
        memories,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('getMemories error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// GET /api/memories/:id — Lấy chi tiết kỷ niệm
const getMemoryById = async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id).populate(
      'createdBy',
      'displayName gender avatar'
    );

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kỷ niệm',
        data: null,
      });
    }

    res.status(200).json({ success: true, message: 'OK', data: memory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// POST /api/memories — Tạo kỷ niệm mới
const createMemory = async (req, res) => {
  try {
    const { title, description, date, location, category, mood } = req.body;

    if (!title || !date) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề và ngày là bắt buộc',
        data: null,
      });
    }

    // Xử lý ảnh upload
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map((file) => ({
        url: file.path, // Cloudinary URL is in file.path
        caption: '',
      }));
    }

    const memory = await Memory.create({
      title,
      description,
      date: new Date(date),
      location,
      category: category || 'daily',
      mood: mood || 'happy',
      images,
      createdBy: req.user.id,
    });

    const populated = await Memory.findById(memory._id).populate(
      'createdBy',
      'displayName gender avatar'
    );

    res.status(201).json({
      success: true,
      message: 'Đã lưu kỷ niệm! 💕',
      data: populated,
    });
  } catch (error) {
    console.error('createMemory error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// PUT /api/memories/:id — Cập nhật kỷ niệm
const updateMemory = async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kỷ niệm',
        data: null,
      });
    }

    const { title, description, date, location, category, mood } = req.body;

    const updated = await Memory.findByIdAndUpdate(
      req.params.id,
      { title, description, date: date ? new Date(date) : memory.date, location, category, mood },
      { new: true }
    ).populate('createdBy', 'displayName gender avatar');

    res.status(200).json({ success: true, message: 'Đã cập nhật!', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// DELETE /api/memories/:id — Xóa kỷ niệm
const deleteMemory = async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy kỷ niệm',
        data: null,
      });
    }

    // Xóa ảnh trên Cloudinary nếu có
    if (memory.images && memory.images.length > 0) {
      const cloudinary = require('cloudinary').v2;
      const deletePromises = memory.images.map((img) => {
        try {
          // Cloudinary URL format: https://res.cloudinary.com/<cloud_name>/image/upload/v<version>/<folder>/<public_id>.<ext>
          const urlParts = img.url.split('/');
          const uploadIndex = urlParts.indexOf('upload');
          if (uploadIndex !== -1) {
            // Get everything after 'upload/v<version>/' as the public_id (without extension)
            const pathAfterUpload = urlParts.slice(uploadIndex + 2).join('/');
            const publicId = pathAfterUpload.replace(/\.[^/.]+$/, ''); // remove extension
            return cloudinary.uploader.destroy(publicId);
          }
        } catch (err) {
          console.warn('Could not delete image from Cloudinary:', img.url, err.message);
        }
        return Promise.resolve();
      });
      await Promise.allSettled(deletePromises);
    }

    await Memory.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Đã xóa kỷ niệm', data: null });
  } catch (error) {
    console.error('deleteMemory error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// POST /api/memories/:id/like — Thả tim cho kỷ niệm
const toggleLike = async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    if (!memory) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy', data: null });
    }

    const userId = req.user.id;
    const alreadyLiked = memory.likes.includes(userId);

    if (alreadyLiked) {
      memory.likes = memory.likes.filter((id) => id.toString() !== userId);
    } else {
      memory.likes.push(userId);
    }
    await memory.save();

    res.status(200).json({
      success: true,
      message: alreadyLiked ? 'Đã bỏ thích' : '💕 Đã thích!',
      data: { likes: memory.likes },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

module.exports = { getMemories, getMemoryById, createMemory, updateMemory, deleteMemory, toggleLike };
