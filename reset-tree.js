require('dotenv').config();
const mongoose = require('mongoose');
const LoveTree = require('./models/LoveTree');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');
    // Khôi phục tất cả dữ liệu
    await LoveTree.updateMany({}, {
      level: 1,
      exp: 0,
      streak: 0,
      fertilizers: 1,
      isWithered: false,
      waterLevel: 50,
      sunlightLevel: 50,
      userInteractions: [],
      lastStreakUpdateAt: null,
      $unset: { lastWateredAt: "", lastWateredBy: "", lastSunlightAt: "", lastSunlightBy: "" }
    });
    console.log('Toàn bộ Cây Tình Yêu đã được reset về Level 1, Streak 0, Phân bón 1.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Lỗi kết nối MongoDB:', err);
    process.exit(1);
  });
