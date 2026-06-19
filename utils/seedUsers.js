const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedUsers = async () => {
  try {
    const existingUsers = await User.countDocuments();
    if (existingUsers >= 2) {
      console.log('✅ Tài khoản couple đã tồn tại.');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const password1 = await bcrypt.hash('xuan123', salt);
    const password2 = await bcrypt.hash('dung123', salt);

    const xuanTrung = await User.create({
      username: 'xuan_trung',
      password: password1,
      displayName: 'Xuân Trung',
      gender: 'male',
      avatar: null,
      anniversaryDate: new Date('2023-02-14'),
    });

    const phuongDung = await User.create({
      username: 'phuong_dung',
      password: password2,
      displayName: 'Phương Dung',
      gender: 'female',
      avatar: null,
      partnerId: xuanTrung._id,
      anniversaryDate: new Date('2023-02-14'),
    });

    // Gán partner cho Xuân Trung
    await User.findByIdAndUpdate(xuanTrung._id, { partnerId: phuongDung._id });

    console.log('💕 Đã tạo tài khoản cho Xuân Trung & Phương Dung!');
    console.log('   👦 Xuân Trung — xuan_trung / xuan123');
    console.log('   👧 Phương Dung — phuong_dung / dung123');
  } catch (error) {
    console.error('❌ Lỗi seed users:', error);
  }
};

module.exports = seedUsers;
