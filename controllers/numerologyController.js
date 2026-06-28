const User = require('../models/User');
const DailyNumerology = require('../models/DailyNumerology');
const aiService = require('../services/aiService');

// Helpers for numerology
const reduceToSingleDigit = (num) => {
  if (num === 11 || num === 22 || num === 33) return num;
  let sum = num;
  while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
    sum = sum.toString().split('').reduce((acc, digit) => acc + parseInt(digit), 0);
  }
  return sum;
};

const getPathNumber = (dateString) => {
  if (!dateString) return 0;
  const digits = dateString.split('T')[0].replace(/\D/g, ''); 
  const sum = digits.split('').reduce((acc, d) => acc + parseInt(d), 0);
  return reduceToSingleDigit(sum);
};

const getTodayNumerology = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    
    // Kiểm tra xem user có partner không
    if (!user.partnerId) {
      return res.status(400).json({ success: false, message: 'Bạn chưa kết nối với đối phương.' });
    }

    const partner = await User.findById(user.partnerId);
    if (!partner) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy đối phương.' });
    }

    // Yêu cầu cả 2 phải có ngày sinh
    if (!user.birthday) {
      return res.status(400).json({ success: false, message: 'Vui lòng cập nhật Ngày Sinh của bạn trong Trang Cá Nhân để tính Thần Số Học.' });
    }
    if (!partner.birthday) {
      return res.status(400).json({ success: false, message: 'Đối phương chưa cập nhật Ngày Sinh trong Trang Cá Nhân.' });
    }

    // Tạo ID cặp đôi thống nhất (sắp xếp ID để không bị đảo ngược)
    const sortedIds = [user._id.toString(), partner._id.toString()].sort();
    const coupleId = `${sortedIds[0]}_${sortedIds[1]}`;

    // Ngày hiện tại
    const today = new Date();
    // Đảm bảo lấy ngày theo timezone VN hoặc UTC chuẩn
    const dateStr = today.toISOString().split('T')[0]; 

    // Kiểm tra DB xem hôm nay đã tính chưa
    let numerology = await DailyNumerology.findOne({ coupleId, date: dateStr });

    if (numerology) {
      return res.status(200).json({ success: true, data: numerology });
    }

    // CHƯA CÓ -> Tính toán
    const userPath = getPathNumber(user.birthday.toISOString());
    const partnerPath = getPathNumber(partner.birthday.toISOString());
    const todayPath = getPathNumber(dateStr);

    const energyNumber = reduceToSingleDigit(userPath + partnerPath + todayPath);

    // Gọi AI tạo lời khuyên
    const aiResult = await aiService.generateDailyNumerology(energyNumber, user.bio, partner.bio);

    // Lưu vào DB
    numerology = await DailyNumerology.create({
      coupleId,
      date: dateStr,
      energyNumber,
      meaning: aiResult.meaning,
      advice: aiResult.advice,
      actionPrompt: aiResult.actionPrompt
    });

    res.status(200).json({ success: true, data: numerology });

  } catch (error) {
    console.error('Lỗi khi lấy Thần số học:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi tính Thần Số Học.' });
  }
};

module.exports = {
  getTodayNumerology
};
