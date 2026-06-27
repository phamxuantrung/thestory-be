const User = require('../models/User');

const getVnDate = () => {
  const now = new Date();
  const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(vnTimeStr);
  const year = vnDate.getFullYear();
  const month = String(vnDate.getMonth() + 1).padStart(2, '0');
  const day = String(vnDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PRIZES = [
  { id: 0, label: '100 Heart', value: 100, type: 'heart' },
  { id: 1, label: '10 Heart', value: 10, type: 'heart' },
  { id: 2, label: 'Tiếc quá', value: 0, type: 'miss' }, // Chúc may mắn lần sau
  { id: 3, label: '5 Heart', value: 5, type: 'heart' },
  { id: 4, label: '20 Heart', value: 20, type: 'heart' },
  { id: 5, label: '10 Heart', value: 10, type: 'heart' },
  { id: 6, label: 'Hụt rồi', value: 0, type: 'miss' }, // Chúc may mắn lần sau
  { id: 7, label: '5 Heart', value: 5, type: 'heart' },
  { id: 8, label: '10 Heart', value: 10, type: 'heart' },
  { id: 9, label: 'Cố lên', value: 0, type: 'miss' }, // Chúc may mắn lần sau
  { id: 10, label: '10 Heart', value: 10, type: 'heart' },
  { id: 11, label: '20 Heart', value: 20, type: 'heart' },
  { id: 12, label: '10 Heart', value: 10, type: 'heart' },
];

const getStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const todayDate = getVnDate();

    // Check if we need to assign a new spin for today
    if (user.dailySpinAssignedDate !== todayDate) {
      // User hasn't been assigned a spin today
      // Rule: Spins cannot accumulate. If they already have a spin from before, they don't get a NEW chance until they use it.
      // Wait, "chỉ được một lượt quay cho tới khi sử dụng mới được tỉ lệ ra lượt quay khác"
      // If dailySpinCount > 0, we don't assign a new one, but we DO update the date so we don't keep trying to assign?
      // Actually, if they haven't used yesterday's spin, they don't get today's 30% chance.
      if (user.dailySpinCount > 0) {
        user.dailySpinAssignedDate = todayDate; // Just mark as checked for today
      } else {
        // 30% chance
        const isLucky = Math.random() < 0.3;
        if (isLucky) {
          user.dailySpinCount = 1;
        }
        user.dailySpinAssignedDate = todayDate;
      }
      await user.save();
    }

    res.json({
      success: true,
      data: {
        hasSpin: user.dailySpinCount > 0,
        spinCount: user.dailySpinCount,
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy trạng thái Vòng quay:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const spinWheel = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || user.dailySpinCount <= 0) {
      return res.status(400).json({ success: false, message: 'Bạn không có lượt quay nào!' });
    }

    // Select random prize (0 to 12)
    const prizeIndex = Math.floor(Math.random() * PRIZES.length);
    const prize = PRIZES[prizeIndex];

    // Deduct spin
    user.dailySpinCount = 0; // cannot accumulate, reset to 0
    
    // Add heart
    if (prize.type === 'heart' && prize.value > 0) {
      user.heart += prize.value;
    }

    await user.save();

    res.json({
      success: true,
      data: {
        prizeIndex: prizeIndex,
        prize: prize,
        totalHeart: user.heart
      }
    });

  } catch (error) {
    console.error('Lỗi khi quay Vòng quay:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = {
  getStatus,
  spinWheel
};
