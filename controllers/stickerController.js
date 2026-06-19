const Sticker = require('../models/Sticker');
const User = require('../models/User');

exports.uploadSticker = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image provided' });
    }
    const newSticker = new Sticker({
      userId: req.user.id,
      url: req.file.path,
    });
    await newSticker.save();
    res.status(201).json({ success: true, data: newSticker });
  } catch (error) {
    console.error('Upload sticker error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getCustomStickers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const partnerId = user.partnerId;
    const queryIds = [req.user.id];
    if (partnerId) queryIds.push(partnerId);

    const stickers = await Sticker.find({ userId: { $in: queryIds } }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: stickers });
  } catch (error) {
    console.error('Get stickers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteSticker = async (req, res) => {
  try {
    const sticker = await Sticker.findById(req.params.id);
    if (!sticker) {
      return res.status(404).json({ success: false, message: 'Sticker not found' });
    }
    if (sticker.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await sticker.deleteOne();
    res.status(200).json({ success: true, message: 'Sticker deleted' });
  } catch (error) {
    console.error('Delete sticker error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
