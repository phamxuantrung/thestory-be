const DailyMood = require('../models/DailyMood');
const User = require('../models/User');

// Helper để normalize date (bỏ giờ phút giây)
// Thay thế hàm startOfDay cũ bằng logic xử lý múi giờ VN (UTC+7)
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds

const startOfDay = (dateInput) => {
  // Lấy timestamp từ input hoặc thời điểm hiện tại
  const timeMs = dateInput ? new Date(dateInput).getTime() : Date.now();

  // Dịch chuyển sang múi giờ VN
  const nowUtcMs = timeMs + VN_OFFSET_MS;

  // Làm tròn về 00:00 theo giờ VN
  const vnMidnightMs = Math.floor(nowUtcMs / 86400000) * 86400000;

  // Trả về lại chuẩn UTC để lưu vào database
  return new Date(vnMidnightMs - VN_OFFSET_MS);
};

// POST /api/moods — Lưu mood cho ngày hôm nay
const logMood = async (req, res) => {
  try {
    const { mood, note, date } = req.body;

    if (!mood) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn tâm trạng', data: null });
    }

    const moodDate = startOfDay(date || new Date());

    // Cập nhật hoặc tạo mới
    const savedMood = await DailyMood.findOneAndUpdate(
      { user: req.user.id, date: moodDate },
      { mood, note, date: moodDate },
      { new: true, upsert: true }
    ).populate('user', 'displayName avatar');

    res.status(200).json({ success: true, message: 'Đã lưu tâm trạng', data: savedMood });
  } catch (error) {
    console.error('logMood error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// GET /api/moods/stats — Lấy thống kê của tháng
const getMoodStats = async (req, res) => {
  try {
    const { month, year } = req.query; // e.g. month=6, year=2026

    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Vui lòng truyền month và year', data: null });
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

    // Mùng 1 của tháng lúc 00:00 giờ VN -> chuyển sang chuẩn UTC
    const startDateMs = new Date(Date.UTC(y, m - 1, 1)).getTime() - VN_OFFSET_MS;
    const startDate = new Date(startDateMs);

    // Ngày cuối cùng của tháng lúc 23:59:59.999 giờ VN -> chuyển sang chuẩn UTC
    const endDateMs = new Date(Date.UTC(y, m, 1)).getTime() - VN_OFFSET_MS - 1;
    const endDate = new Date(endDateMs);

    const user = await User.findById(req.user.id);
    const usersToFetch = [req.user.id];
    if (user.partnerId) {
      usersToFetch.push(user.partnerId);
    }

    const moods = await DailyMood.find({
      user: { $in: usersToFetch },
      date: { $gte: startDate, $lte: endDate }
    }).populate('user', 'displayName gender avatar');

    // Gom nhóm theo user và đếm
    const stats = {};
    usersToFetch.forEach(uid => {
      stats[uid] = { happy: 0, very_happy: 0, sad: 0, angry: 0, displayName: '' };
    });

    moods.forEach(m => {
      const uid = m.user._id.toString();
      if (stats[uid]) {
        stats[uid].displayName = m.user.displayName;
        if (stats[uid][m.mood] !== undefined) {
          stats[uid][m.mood]++;
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'OK',
      data: {
        raw: moods, // Gửi raw data để render lịch
        stats // Gửi stats để hiển thị tổng kết
      }
    });
  } catch (error) {
    console.error('getMoodStats error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

module.exports = { logMood, getMoodStats };
