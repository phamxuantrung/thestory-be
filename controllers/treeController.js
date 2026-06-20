const LoveTree = require('../models/LoveTree');
const User = require('../models/User');

const getExpRequired = (level) => {
  switch(level) {
    case 1: return 300;   // Khoảng 1 tuần (Trung bình 40-50 EXP/ngày)
    case 2: return 700;   // Khoảng 2-3 tuần
    case 3: return 1200;  // Khoảng 1 tháng
    case 4: return 2500;  // Cấp cuối cần vượt trội, tốn khoảng gần 2 tháng để max
    default: return 5000; // Cap cho max level
  }
};

// GET /api/tree
const getTree = async (req, res) => {
  try {
    const partner = await User.findOne({ code: req.user.partnerCode });
    const users = [req.user.id];
    if (partner) users.push(partner._id);

    // Tìm cây của cặp đôi
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } })
      .populate('lastWateredBy', 'displayName avatar')
      .populate('lastSunlightBy', 'displayName avatar');

    if (!tree) {
      // Nếu chưa có, tạo cây mới cho cặp đôi
      tree = await LoveTree.create({
        users: users,
        userInteractions: users.map(u => ({ user: u, lastActionAt: null })),
        level: 1,
        exp: 0,
        waterLevel: 50,
        sunlightLevel: 50,
        lastWateredAt: new Date(), // Cho phép 24h đầu tiên không bị héo
        lastSunlightAt: new Date(),
        lastStreakUpdateAt: null
      });
      tree = await LoveTree.findById(tree._id)
        .populate('lastWateredBy', 'displayName avatar')
        .populate('lastSunlightBy', 'displayName avatar');
    } else {
      // Đảm bảo có đủ user trong userInteractions
      let updated = false;
      users.forEach(u => {
        if (!tree.userInteractions.find(ui => ui.user.toString() === u.toString())) {
          tree.userInteractions.push({ user: u, lastActionAt: null });
          updated = true;
        }
      });
      if (updated) await tree.save();
    }

    // Logic kiểm tra héo cây (nếu đã qua 24h kể từ lần cuối tưới VÀ phơi nắng)
    const now = new Date();
    const waterDiff = tree.lastWateredAt ? now - tree.lastWateredAt : 0;
    const sunDiff = tree.lastSunlightAt ? now - tree.lastSunlightAt : 0;
    const ONE_DAY = 24 * 60 * 60 * 1000;

    // Phải là cả 2 hành động đều quên > 1 ngày thì mới héo
    if (!tree.isWithered && waterDiff > ONE_DAY && sunDiff > ONE_DAY) {
      tree.isWithered = true;
      await tree.save();
    }

    res.status(200).json({ success: true, data: tree, expRequired: getExpRequired(tree.level) });
  } catch (error) {
    console.error('getTree error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// POST /api/tree/interact
// body: { action: 'water' | 'sunlight' }
const interactTree = async (req, res) => {
  try {
    const { action } = req.body;
    if (!['water', 'sunlight'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Hành động không hợp lệ' });
    }

    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });
    }

    if (tree.isWithered) {
      return res.status(400).json({ success: false, message: 'Cây đã héo! Hãy dùng Phân Bón để hồi sinh cây trước nhé.' });
    }

    const now = new Date();
    const hour = now.getHours();
    const weather = req.body.weather || { temp: 25, rain: 0 };
    let expChange = 0;
    let msg = '';
    let bonusMsg = [];

    const isSameDay = (d1, d2) => {
      if (!d1 || !d2) return false;
      return new Date(d1).toDateString() === new Date(d2).toDateString();
    };

    // Tìm interaction của user hiện tại
    let userInteraction = tree.userInteractions.find(ui => ui.user.toString() === req.user.id);
    if (!userInteraction) {
      userInteraction = { user: req.user.id, lastActionAt: null };
      tree.userInteractions.push(userInteraction);
    }

    if (isSameDay(userInteraction.lastActionAt, now)) {
      return res.status(400).json({ success: false, message: 'Hôm nay bạn đã chăm sóc cây rồi, hãy để phần cho người kia nhé!' });
    }

    // Reset streak nếu hôm qua bị đứt
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (tree.lastStreakUpdateAt && !isSameDay(tree.lastStreakUpdateAt, now) && !isSameDay(tree.lastStreakUpdateAt, yesterday)) {
      tree.streak = 0;
    }

    // Tưới nước
    if (action === 'water') {
      let baseExp = 15;
      
      // Thời tiết
      if (weather.rain > 0) {
        baseExp -= 15;
        bonusMsg.push('Trời mưa mà lại tưới thêm nước (Úng rễ)');
      } else if (weather.temp > 35) {
        baseExp += 40;
        bonusMsg.push('Giải khát giữa trưa nắng gắt');
      } else if (weather.temp > 30) {
        baseExp += 25;
        bonusMsg.push('Giải nhiệt ngày nóng');
      } else if (weather.temp < 20) {
        baseExp -= 10;
        bonusMsg.push('Tưới nước ngày lạnh làm cây cóng');
      }

      // Giờ giấc
      if (hour >= 6 && hour <= 8) {
        baseExp += 10;
        bonusMsg.push('Tưới sáng sớm cực tốt');
      } else if (hour >= 22 || hour < 5) {
        baseExp -= 5;
        bonusMsg.push('Tưới đêm sinh nấm bệnh');
      }

      // Tình trạng cây
      if (tree.waterLevel < 20) {
        baseExp += 30;
        bonusMsg.push('Cứu mạng cây khô héo');
      } else if (tree.waterLevel > 80) {
        baseExp -= 20;
        bonusMsg.push('Cây đang úng nước vẫn tưới');
      }

      tree.waterLevel = Math.min(100, Math.max(0, tree.waterLevel + 20));
      expChange = baseExp;
      tree.lastWateredBy = req.user.id;
      tree.lastWateredAt = now;
      msg = `Tưới nước: ${expChange > 0 ? '+' : ''}${expChange} EXP. ${bonusMsg.length ? '(' + bonusMsg.join(' | ') + ')' : ''}`;
    }

    // Phơi nắng
    if (action === 'sunlight') {
      let baseExp = 15;

      // Thời tiết
      if (weather.rain > 0) {
        baseExp += 25;
        bonusMsg.push('Sưởi ấm ngày mưa');
      } else if (weather.temp > 35) {
        baseExp -= 20;
        bonusMsg.push('Phơi nắng gắt làm cháy lá');
      } else if (weather.temp < 20) {
        baseExp += 30;
        bonusMsg.push('Sưởi ấm ngày đông giá lạnh');
      }

      // Giờ giấc
      if (hour >= 18 || hour < 5) {
        baseExp -= 10;
        bonusMsg.push('Ban đêm làm gì có nắng?');
      } else if (hour >= 11 && hour <= 14 && weather.temp <= 30) {
        baseExp += 10;
        bonusMsg.push('Quang hợp cực đại');
      }

      // Tình trạng cây
      if (tree.sunlightLevel < 20) {
        baseExp += 30;
        bonusMsg.push('Cứu mạng cây thiếu sáng');
      } else if (tree.sunlightLevel > 80) {
        baseExp -= 20;
        bonusMsg.push('Quá tải ánh sáng');
      }

      tree.sunlightLevel = Math.min(100, Math.max(0, tree.sunlightLevel + 20));
      expChange = baseExp;
      tree.lastSunlightBy = req.user.id;
      tree.lastSunlightAt = now;
      msg = `Phơi nắng: ${expChange > 0 ? '+' : ''}${expChange} EXP. ${bonusMsg.length ? '(' + bonusMsg.join(' | ') + ')' : ''}`;
    }

    tree.exp = Math.max(0, tree.exp + expChange);
    userInteraction.lastActionAt = now;

    // Xử lý Streak
    const allUsersActedToday = tree.userInteractions.length > 0 && tree.userInteractions.every(ui => isSameDay(ui.lastActionAt, now));
    if (allUsersActedToday) {
      if (!isSameDay(tree.lastStreakUpdateAt, now)) {
        if (tree.lastStreakUpdateAt && isSameDay(tree.lastStreakUpdateAt, yesterday)) {
          tree.streak += 1;
        } else {
          tree.streak = 1;
        }
        tree.lastStreakUpdateAt = now;
        msg += ` 🌟 Chuỗi ngày chăm sóc tăng lên ${tree.streak}!`;
      }
    } else {
      msg += ` (Đợi người kia chăm sóc để tăng Chuỗi nhé)`;
    }

    // Xử lý Level Up
    const expRequired = getExpRequired(tree.level);
    if (tree.exp >= expRequired && tree.level < 5) {
      tree.level += 1;
      tree.exp = tree.exp - expRequired;
      msg += ` 🎉 Chúc mừng Cây đã lên cấp ${tree.level}!`;
    }
    // Giới hạn max level
    if (tree.level >= 5 && tree.exp > getExpRequired(5)) {
      tree.exp = getExpRequired(5);
    }

    await tree.save();

    const populated = await LoveTree.findById(tree._id)
      .populate('lastWateredBy', 'displayName avatar')
      .populate('lastSunlightBy', 'displayName avatar');

    res.status(200).json({ 
      success: true, 
      message: action === 'water' ? 'Đã tưới nước cho cây 💧' : 'Đã phơi nắng cho cây ☀️',
      data: populated,
      expRequired: getExpRequired(populated.level)
    });

  } catch (error) {
    console.error('interactTree error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// POST /api/tree/revive
const reviveTree = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });

    if (!tree.isWithered) {
      return res.status(400).json({ success: false, message: 'Cây vẫn đang khỏe mạnh!' });
    }

    if (tree.fertilizers < 1) {
      return res.status(400).json({ success: false, message: 'Bạn không đủ Phân Bón! Hãy chơi Minigame để kiếm thêm.' });
    }

    tree.fertilizers -= 1;
    tree.isWithered = false;
    tree.waterLevel = 50;
    tree.sunlightLevel = 50;
    tree.streak = 1; // Hồi sinh xong thì chuỗi bắt đầu lại từ 1
    tree.lastStreakUpdateAt = new Date();
    tree.lastWateredAt = new Date();
    tree.lastSunlightAt = new Date();
    
    // Reset userInteractions to today
    const now = new Date();
    tree.userInteractions.forEach(ui => {
      ui.lastActionAt = now;
    });

    await tree.save();

    const populated = await LoveTree.findById(tree._id)
      .populate('lastWateredBy', 'displayName avatar')
      .populate('lastSunlightBy', 'displayName avatar');

    res.status(200).json({ success: true, message: 'Đã hồi sinh cây thành công! 🌸', data: populated, expRequired: getExpRequired(populated.level) });
  } catch (error) {
    console.error('reviveTree error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/tree/add-fertilizer
const addFertilizer = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });

    tree.fertilizers += 1;
    await tree.save();

    res.status(200).json({ success: true, message: 'Đã nhận được 1 Phân Bón! 👝', data: tree });
  } catch (error) {
    console.error('addFertilizer error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = {
  getTree,
  interactTree,
  reviveTree,
  addFertilizer,
};
