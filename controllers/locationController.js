const LoveLocation = require('../models/LoveLocation');
const User = require('../models/User');

// POST /api/locations — Thêm địa điểm mới
const addLocation = async (req, res) => {
  try {
    const { lat, lng, name, description, category, date, address, linkedMemory } = req.body;
    
    if (!lat || !lng || !name) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc', data: null });
    }

    const location = await LoveLocation.create({
      user: req.user.id,
      lat,
      lng,
      name,
      description,
      category,
      date: date ? new Date(date) : new Date(),
      address: address || '',
      linkedMemory: linkedMemory || null,
    });

    const populated = await LoveLocation.findById(location._id)
      .populate('user', 'displayName avatar')
      .populate('linkedMemory', 'title images');

    res.status(201).json({ success: true, message: 'Đã lưu địa điểm kỷ niệm! 📍', data: populated });
  } catch (error) {
    console.error('addLocation error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// GET /api/locations — Lấy danh sách địa điểm của cặp đôi
const getLocations = async (req, res) => {
  try {
    const partner = await User.findOne({ code: req.user.partnerCode });
    const usersToFetch = [req.user.id];
    if (partner) usersToFetch.push(partner._id);

    const locations = await LoveLocation.find({ user: { $in: usersToFetch } })
      .populate('user', 'displayName avatar')
      .populate('linkedMemory', 'title images')
      .sort({ date: -1 });

    res.status(200).json({ success: true, data: locations });
  } catch (error) {
    console.error('getLocations error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// DELETE /api/locations/:id — Xóa địa điểm
const deleteLocation = async (req, res) => {
  try {
    const location = await LoveLocation.findOneAndDelete({ _id: req.params.id, user: req.user.id });

    if (!location) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa điểm hoặc bạn không có quyền xóa', data: null });
    }

    res.status(200).json({ success: true, message: 'Đã xóa địa điểm', data: null });
  } catch (error) {
    console.error('deleteLocation error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

module.exports = { addLocation, getLocations, deleteLocation };
