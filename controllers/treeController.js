const LoveTree = require('../models/LoveTree');
const User = require('../models/User');

const getVNDate = (date) => {
  if (!date) return null;
  return new Date(new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
};

const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  const vn1 = getVNDate(d1);
  const vn2 = getVNDate(d2);
  return vn1.toDateString() === vn2.toDateString();
};


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
        isPlanted: false,
        level: 1,
        exp: 0,
        waterLevel: 50,
        sunlightLevel: 50,
        lastWateredAt: null,
        lastSunlightAt: null,
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

    if (!tree.isPlanted) {
      return res.status(200).json({ success: true, data: tree, expRequired: getExpRequired(tree.level) });
    }

    
    const now = new Date();
    
    // Logic kiểm tra héo cây do thiếu chăm sóc (qua 24h) hoặc thiếu EXP
    let shouldWither = false;
    let isTreeChanged = false;

    // 0. Trừ EXP nếu đang bị sâu bệnh (1 EXP mỗi 10 phút)
    if (tree.hasPest) {
      const minutesSinceDamage = tree.lastPestDamageAt ? (now - tree.lastPestDamageAt) / (1000 * 60) : 0;
      if (minutesSinceDamage >= 10) {
        const damage = Math.floor(minutesSinceDamage / 10) * 1; // -1 EXP mỗi 10 phút
        tree.exp = Math.max(0, tree.exp - damage);
        tree.lastPestDamageAt = new Date(tree.lastPestDamageAt.getTime() + Math.floor(minutesSinceDamage / 10) * 10 * 60 * 1000);
        isTreeChanged = true;
      }
    }

    // 0.1 Trừ EXP nếu đang có Bão mà không có cọc chống cây (10 EXP mỗi giờ)
    if (tree.activeWeather === 'storm' && !tree.hasTreeProp) {
      const hoursSinceDamage = tree.lastWeatherDamageAt ? (now - tree.lastWeatherDamageAt) / (1000 * 60 * 60) : 0;
      if (hoursSinceDamage >= 1) {
        const damage = Math.floor(hoursSinceDamage) * 10; // -10 EXP mỗi giờ
        tree.exp = Math.max(0, tree.exp - damage);
        tree.lastWeatherDamageAt = new Date(tree.lastWeatherDamageAt.getTime() + Math.floor(hoursSinceDamage) * 60 * 60 * 1000);
        isTreeChanged = true;
      }
    }
    
    // 1. Kiểm tra héo do không chăm sóc > 24h
    const waterDiff = tree.lastWateredAt ? now - tree.lastWateredAt : 0;
    const sunDiff = tree.lastSunlightAt ? now - tree.lastSunlightAt : 0;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (waterDiff > ONE_DAY && sunDiff > ONE_DAY) {
      shouldWither = true;
    }

    // 2. Kiểm tra Daily Exp và Reset
    if (tree.lastDailyExpResetAt && !isSameDay(tree.lastDailyExpResetAt, now)) {
      // Đã sang ngày mới, kiểm tra exp ngày hôm qua
      if (tree.dailyExp < 15) {
        shouldWither = true;
      }
      // Reset cho ngày mới
      tree.dailyExp = 0;
      tree.lastDailyExpResetAt = now;

      // Spawn Pest Mechanic: 40% chance
      if (!tree.isWithered && !shouldWither && !tree.hasPest && Math.random() < 0.40) {
        tree.hasPest = true;
        tree.pestSpawnedAt = now;
        tree.lastPestDamageAt = now;
      }

      // Spawn Weed Mechanic: 30% chance
      if (!tree.isWithered && !shouldWither && tree.weedCount < 3 && Math.random() < 0.30) {
        tree.weedCount += 1;
        tree.weedSpawnedAt = now;
      }

      // Extreme Weather Logic
      if (tree.activeWeather === 'drought' && tree.droughtWaterings < 3) {
        shouldWither = true;
        tree.witherReason = 'Cây đã chết khô do không được tưới đủ nước trong ngày Hạn hán!';
      }

      // End weather randomly or if withered
      if (tree.activeWeather !== 'none') {
        if (shouldWither || Math.random() < 0.40) {
          tree.activeWeather = 'none';
          tree.hasTreeProp = false;
          tree.droughtWaterings = 0;
        }
      } else if (!tree.isWithered && !shouldWither) {
        // Spawn Weather: 15% storm, 15% drought
        const weatherRand = Math.random();
        if (weatherRand < 0.15) {
          tree.activeWeather = 'storm';
          tree.weatherStartedAt = now;
          tree.lastWeatherDamageAt = now;
          tree.hasTreeProp = false;
        } else if (weatherRand < 0.30) {
          tree.activeWeather = 'drought';
          tree.weatherStartedAt = now;
          tree.droughtWaterings = 0;
        }
      }

      if (!shouldWither && Math.random() < 0.15) {
        shouldWither = true;
        const reasons = [
          'Đêm qua bão lớn đã làm cây bị gãy cành!',
          'Một bầy sâu rệp đã tấn công cây vào ban đêm!',
          'Thời tiết khắc nghiệt khiến cây kiệt sức!',
          'Sương muối rụng lá, cây đang thoi thóp!'
        ];
        tree.witherReason = reasons[Math.floor(Math.random() * reasons.length)];
      }

      await tree.save();
    } else if (!tree.lastDailyExpResetAt) {
      tree.lastDailyExpResetAt = now;
      await tree.save();
    }

    if (!tree.isWithered && shouldWither) {
      tree.isWithered = true;
      tree.hasPest = false; // Xoá sâu bọ khi cây héo
      await tree.save();
    }

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    if (tree.level < 5 && tree.streak > 0 && tree.lastStreakUpdateAt && !isSameDay(tree.lastStreakUpdateAt, now) && !isSameDay(tree.lastStreakUpdateAt, yesterday)) {
      if (!tree.isStreakBroken) {
        tree.isStreakBroken = true;
        const brokenDate = new Date(tree.lastStreakUpdateAt);
        brokenDate.setDate(brokenDate.getDate() + 1);
        tree.streakBrokenAt = brokenDate;
        isTreeChanged = true;
      }
    }

    // Reset nếu gãy quá 3 ngày
    if (tree.isStreakBroken && tree.streakBrokenAt) {
      const brokenDiff = now - tree.streakBrokenAt;
      if (brokenDiff >= 3 * ONE_DAY) {
        tree.streak = 0;
        tree.isStreakBroken = false;
        tree.streakBrokenAt = null;
        tree.level = 1;
        tree.exp = 0;
        tree.dailyExp = 0;
        tree.isWithered = false;
        tree.witherReason = null;
        tree.waterLevel = 50;
        tree.sunlightLevel = 50;
        tree.userInteractions = []; // xoá lịch sử tương tác
        tree.isPlanted = false; // Reset về lúc gieo hạt giống
        isTreeChanged = true;
      }
    }

    if (isTreeChanged) {
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


    const now = new Date();
    const hour = getVNDate(now).getHours();
    const weather = req.body.weather || { temp: 25, rain: 0 };
    let expChange = 0;
    let msg = '';
    let bonusMsg = [];

    
    // Tìm interaction của user hiện tại
    let userInteraction = tree.userInteractions.find(ui => ui.user.toString() === req.user.id);
    if (!userInteraction) {
      userInteraction = { user: req.user.id, lastActionAt: null, lastWateredAt: null, lastSunlightAt: null };
      tree.userInteractions.push(userInteraction);
    }

    // Reset streak nếu hôm qua bị đứt
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    if (tree.level < 5 && tree.streak > 0 && tree.lastStreakUpdateAt && !isSameDay(tree.lastStreakUpdateAt, now) && !isSameDay(tree.lastStreakUpdateAt, yesterday)) {
      if (!tree.isStreakBroken) {
        tree.isStreakBroken = true;
        const brokenDate = new Date(tree.lastStreakUpdateAt);
        brokenDate.setDate(brokenDate.getDate() + 1);
        tree.streakBrokenAt = brokenDate;
      }
    }

    if (tree.isStreakBroken && tree.streakBrokenAt) {
      const ONE_DAY = 24 * 60 * 60 * 1000;
      const brokenDiff = now - tree.streakBrokenAt;
      if (brokenDiff >= 3 * ONE_DAY) {
        tree.streak = 0;
        tree.isStreakBroken = false;
        tree.streakBrokenAt = null;
        tree.level = 1;
        tree.exp = 0;
        tree.dailyExp = 0;
        tree.isWithered = false;
        tree.witherReason = null;
        tree.waterLevel = 50;
        tree.sunlightLevel = 50;
        tree.userInteractions = [];
        tree.isPlanted = false; // Reset về lúc gieo hạt giống
      } else {
        return res.status(400).json({ 
          success: false, 
          needsStreakDecision: true,
          message: 'Chuỗi đã gãy! Hãy mở Túi Vật Phẩm dùng Khiên để khôi phục hoặc Bỏ qua (Reset).' 
        });
      }
    }

    // Tưới nước
    if (action === 'water') {
      if (tree.activeWeather === 'drought') {
        if (tree.lastWateredAt && (now - tree.lastWateredAt) < 4 * 60 * 60 * 1000) {
          return res.status(400).json({ success: false, message: 'Phải chờ ít nhất 4 tiếng kể từ lần tưới trước trong mùa hạn hán!' });
        }
        if (tree.droughtWaterings >= 3) {
          return res.status(400).json({ success: false, message: 'Hôm nay bạn đã tưới đủ 3 lần cho mùa hạn hán rồi!' });
        }
      } else {
        if (isSameDay(userInteraction.lastWateredAt, now)) {
          return res.status(400).json({ success: false, message: 'Hôm nay bạn đã tưới nước rồi!' });
        }
      }

      let baseExp = 15;
      
      // Thời tiết
      if (tree.activeWeather === 'storm') {
        baseExp -= 20;
        bonusMsg.push('Tưới nước khi đang bão lớn (Trôi rễ cây)');
      } else if (weather.rain > 0) {
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
      tree.lastWateredBy = req.user.id;
      tree.lastWateredAt = now;
      userInteraction.lastWateredAt = now;
      if (tree.activeWeather === 'drought') {
        tree.droughtWaterings += 1;
      }
      
      if (tree.isWithered) {
        expChange = 0;
        msg = 'Đã tưới nước! Nhưng cây đang héo nên không nhận được EXP. Hãy dùng Phân bón để cứu cây!';
      } else {
        if (Math.random() < 0.10) {
          tree.isWithered = true;
          const reasons = [
            'Bạn vô tình tưới phải nước nóng làm cây bỏng rễ!',
            'Vừa tưới xong thì một con mèo chạy qua cắn gãy cành!',
            'Nước bị nhiễm mặn, cây sốc nhiệt héo rũ!',
          ];
          tree.witherReason = reasons[Math.floor(Math.random() * reasons.length)];
          expChange = 0;
          msg = `THẢM HỌA! ${tree.witherReason} Cây đã bị héo ngay lập tức!`;
        } else {
          expChange = baseExp;
          msg = `Tưới nước: ${expChange > 0 ? '+' : ''}${expChange} EXP. ${bonusMsg.length ? '(' + bonusMsg.join(' | ') + ')' : ''}`;
        }
      }
    }

    // Phơi nắng
    if (action === 'sunlight') {
      if (tree.activeWeather === 'drought') {
        tree.isWithered = true;
        tree.witherReason = 'Trời đang hạn hán mà bạn còn phơi nắng làm cây chết khô ngay lập tức!';
        tree.sunlightLevel = 100;
        await tree.save();
        return res.status(200).json({ 
          success: true, 
          message: `THẢM HỌA! ${tree.witherReason}`, 
          data: tree, 
          expRequired: getExpRequired(tree.level) 
        });
      }

      if (isSameDay(userInteraction.lastSunlightAt, now)) {
        return res.status(400).json({ success: false, message: 'Hôm nay bạn đã phơi nắng rồi!' });
      }

      let baseExp = 15;

      // Thời tiết
      if (tree.activeWeather === 'storm') {
        baseExp += 20;
        bonusMsg.push('Dũng cảm đón nắng hiếm hoi giữa bão');
      }
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
      tree.lastSunlightBy = req.user.id;
      tree.lastSunlightAt = now;
      userInteraction.lastSunlightAt = now;
      
      if (tree.isWithered) {
        expChange = 0;
        msg = 'Đã phơi nắng! Nhưng cây đang héo nên không nhận được EXP. Hãy dùng Phân bón để cứu cây!';
      } else {
        if (Math.random() < 0.10) {
          tree.isWithered = true;
          const reasons = [
            'Nắng gắt bất thường khiến cây bị cháy nắng héo rũ!',
            'Tia UV quá mạnh làm hỏng lá cây!',
            'Mất tập trung phơi nắng quá lâu làm cây kiệt sức!',
          ];
          tree.witherReason = reasons[Math.floor(Math.random() * reasons.length)];
          expChange = 0;
          msg = `THẢM HỌA! ${tree.witherReason} Cây đã bị héo ngay lập tức!`;
        } else {
          expChange = baseExp;
          msg = `Phơi nắng: ${expChange > 0 ? '+' : ''}${expChange} EXP. ${bonusMsg.length ? '(' + bonusMsg.join(' | ') + ')' : ''}`;
        }
      }
    }

    if (!tree.isWithered && expChange > 0 && tree.weedCount > 0) {
      const reductionPercent = tree.weedCount * 20;
      expChange = Math.floor(expChange * (1 - reductionPercent / 100));
      msg += ` | 🌿 ${tree.weedCount} cụm cỏ dại hút mất ${reductionPercent}% dinh dưỡng!`;
    }

    tree.exp = Math.max(0, tree.exp + expChange);
    tree.dailyExp += Math.max(0, expChange);
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
    let levelUpCount = 0;
    while (tree.level < 5 && tree.exp >= getExpRequired(tree.level)) {
      tree.exp -= getExpRequired(tree.level);
      tree.level += 1;
      levelUpCount++;
    }
    if (levelUpCount > 0) {
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
      expRequired: getExpRequired(populated.level),
      expChange: expChange
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
    tree.witherReason = null;
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
      ui.lastWateredAt = now;
      ui.lastSunlightAt = now;
    });
    
    // Reset dailyExp sau khi hồi sinh
    tree.dailyExp = 0;
    tree.lastDailyExpResetAt = now;

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

// POST /api/tree/reward
const addReward = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });

    // Lấy số xu từ request, giới hạn tối đa 50 xu mỗi lần nhận để tránh cheat
    let requestedCoins = parseInt(req.body.coins);
    if (isNaN(requestedCoins) || requestedCoins <= 0) {
      requestedCoins = Math.floor(Math.random() * 11) + 20; // fallback 20-30 coins
    }
    const coinsEarned = Math.min(requestedCoins, 50);

    tree.coins += coinsEarned;
    await tree.save();

    res.status(200).json({ success: true, message: `Bạn nhận được ${coinsEarned} Xu! 🪙`, data: tree });
  } catch (error) {
    console.error('addReward error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/tree/buy-item
const buyItem = async (req, res) => {
  try {
    const { item } = req.body;
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });

    if (item === 'fertilizer') {
      if (tree.coins < 200) return res.status(400).json({ success: false, message: 'Không đủ Xu' });
      tree.coins -= 200;
      tree.fertilizers += 1;
    } else if (item === 'shield') {
      if (tree.coins < 1000) return res.status(400).json({ success: false, message: 'Không đủ Xu' });
      tree.coins -= 1000;
      tree.shields += 1;
    } else if (item === 'potion') {
      if (tree.coins < 250) return res.status(400).json({ success: false, message: 'Không đủ Xu' });
      tree.coins -= 250;
      tree.growthPotions += 1;
    } else if (item === 'pesticide') {
      if (tree.coins < 200) return res.status(400).json({ success: false, message: 'Không đủ Xu' });
      tree.coins -= 200;
      tree.pesticides += 1;
    } else if (item === 'tree_prop') {
      if (tree.coins < 150) return res.status(400).json({ success: false, message: 'Không đủ Xu' });
      tree.coins -= 150;
      tree.treeProps += 1;
    } else {
      return res.status(400).json({ success: false, message: 'Vật phẩm không hợp lệ' });
    }

    await tree.save();
    
    const populated = await LoveTree.findById(tree._id)
      .populate('lastWateredBy', 'displayName avatar')
      .populate('lastSunlightBy', 'displayName avatar');

    res.status(200).json({ success: true, message: 'Mua thành công!', data: populated });
  } catch (error) {
    console.error('buyItem error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/tree/use-prop
const useProp = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });

    if (tree.activeWeather !== 'storm') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể dùng Cọc Chống Cây khi đang có bão!' });
    }

    if (tree.hasTreeProp) {
      return res.status(400).json({ success: false, message: 'Cây đã được chống cọc rồi!' });
    }

    if (tree.treeProps <= 0) {
      return res.status(400).json({ success: false, message: 'Bạn không có Cọc Chống Cây' });
    }

    tree.treeProps -= 1;
    tree.hasTreeProp = true;
    
    await tree.save();

    const populated = await LoveTree.findById(tree._id)
      .populate('lastWateredBy', 'displayName avatar')
      .populate('lastSunlightBy', 'displayName avatar');

    res.status(200).json({ 
      success: true, 
      message: 'Đã dùng Cọc Chống Cây! Cây đã an toàn qua cơn bão.', 
      data: populated,
      expRequired: getExpRequired(populated.level)
    });
  } catch (error) {
    console.error('useProp error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/tree/use-potion
const usePotion = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });

    if (tree.growthPotions <= 0) {
      return res.status(400).json({ success: false, message: 'Bạn không có Thuốc Tăng Trưởng' });
    }

    tree.growthPotions -= 1;
    
    // Tăng 50 EXP
    const expChange = 50;
    tree.exp = Math.max(0, tree.exp + expChange);
    tree.dailyExp += expChange;
    
    // Xử lý Level Up
    let levelUpCount = 0;
    while (tree.level < 5 && tree.exp >= getExpRequired(tree.level)) {
      tree.exp -= getExpRequired(tree.level);
      tree.level += 1;
      levelUpCount++;
    }
    let levelUpMsg = '';
    if (levelUpCount > 0) {
      levelUpMsg = ` 🎉 Chúc mừng Cây đã lên cấp ${tree.level}!`;
    }
    if (tree.level >= 5 && tree.exp > getExpRequired(5)) {
      tree.exp = getExpRequired(5);
    }

    await tree.save();

    const populated = await LoveTree.findById(tree._id)
      .populate('lastWateredBy', 'displayName avatar')
      .populate('lastSunlightBy', 'displayName avatar');

    res.status(200).json({ 
      success: true, 
      message: `Đã dùng Thuốc Tăng Trưởng! +${expChange} EXP.${levelUpMsg}`, 
      data: populated,
      expRequired: getExpRequired(populated.level)
    });
  } catch (error) {
    console.error('usePotion error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
// POST /api/tree/restore-streak
const restoreStreak = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });

    if (!tree.isStreakBroken) {
      return res.status(400).json({ success: false, message: 'Chuỗi của bạn không bị gãy' });
    }

    if (tree.shields <= 0) {
      return res.status(400).json({ success: false, message: 'Bạn không có Khiên Bảo Vệ' });
    }

    tree.shields -= 1;
    tree.isStreakBroken = false;
    tree.streakBrokenAt = null;
    
    // Kéo dài chuỗi để hôm nay có thể tiếp tục
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    tree.lastStreakUpdateAt = yesterday; 

    await tree.save();

    const populated = await LoveTree.findById(tree._id)
      .populate('lastWateredBy', 'displayName avatar')
      .populate('lastSunlightBy', 'displayName avatar');

    res.status(200).json({ 
      success: true, 
      message: 'Khôi phục chuỗi thành công! Bạn có thể tiếp tục chăm cây.', 
      data: populated,
      expRequired: getExpRequired(populated.level)
    });
  } catch (error) {
    console.error('restoreStreak error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/tree/reset-streak
const resetStreak = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });

    if (!tree.isStreakBroken) {
      return res.status(400).json({ success: false, message: 'Chuỗi của bạn không bị gãy' });
    }

    tree.streak = 0;
    tree.isStreakBroken = false;
    tree.streakBrokenAt = null;

    await tree.save();

    const populated = await LoveTree.findById(tree._id)
      .populate('lastWateredBy', 'displayName avatar')
      .populate('lastSunlightBy', 'displayName avatar');

    res.status(200).json({ 
      success: true, 
      message: 'Đã hủy chuỗi cũ.', 
      data: populated,
      expRequired: getExpRequired(populated.level)
    });
  } catch (error) {
    console.error('resetStreak error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
// POST /api/tree/dev-cheat
const devCheat = async (req, res) => {
  try {
    const { action } = req.body;
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });
    let userObj = await User.findById(req.user.id);

    switch (action) {
      case 'wither':
        tree.isWithered = true;
        tree.witherReason = "Bị DEV ép héo để test :(";
        break;
      case 'spawn_pest':
        tree.hasPest = true;
        tree.pestSpawnedAt = new Date();
        tree.lastPestDamageAt = new Date();
        break;
      case 'start_storm':
        tree.activeWeather = 'storm';
        tree.weatherStartedAt = new Date();
        tree.lastWeatherDamageAt = new Date();
        tree.hasTreeProp = false;
        break;
      case 'spawn_weed':
        if (tree.weedCount < 3) {
          tree.weedCount += 1;
        }
        tree.weedSpawnedAt = new Date();
        break;
      case 'start_drought':
        tree.activeWeather = 'drought';
        tree.weatherStartedAt = new Date();
        tree.droughtWaterings = 0;
        break;
      case 'break_streak':
        tree.isStreakBroken = true;
        const brokenDate = new Date();
        brokenDate.setDate(brokenDate.getDate() - 1);
        tree.streakBrokenAt = brokenDate;
        tree.streak = Math.max(1, tree.streak);
        break;
      case 'add_coins':
        tree.coins += 1000;
        break;
      case 'add_shield':
        tree.shields += 1;
        break;
      case 'add_fertilizer':
        tree.fertilizers += 1;
        break;
      case 'add_potion':
        tree.growthPotions += 1;
        break;
      case 'add_streak':
        tree.streak += 10;
        break;
      case 'add_exp':
        tree.exp += 1000;
        while (tree.level < 5 && tree.exp >= getExpRequired(tree.level)) {
          tree.exp -= getExpRequired(tree.level);
          tree.level += 1;
        }
        if (tree.level >= 5 && tree.exp > getExpRequired(5)) {
          tree.exp = getExpRequired(5);
        }
        break;
      case 'reset_all':
        tree.isPlanted = false;
        tree.level = 1;
        tree.exp = 0;
        tree.dailyExp = 0;
        tree.streak = 0;
        tree.isStreakBroken = false;
        tree.streakBrokenAt = null;
        tree.isWithered = false;
        tree.witherReason = null;
        tree.waterLevel = 50;
        tree.sunlightLevel = 50;
        tree.shields = 0;
        tree.fertilizers = 0;
        tree.growthPotions = 0;
        tree.pesticides = 0;
        tree.hasPest = false;
        tree.lastWateredAt = null;
        tree.lastSunlightAt = null;
        tree.lastStreakUpdateAt = null;
        tree.lastDailyExpResetAt = null;
        tree.userInteractions = [];
        tree.coins = 0;
        tree.activeWeather = 'none';
        tree.hasTreeProp = false;
        tree.treeProps = 0;
        tree.droughtWaterings = 0;
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid dev action' });
    }

    await tree.save();

    const populated = await LoveTree.findById(tree._id)
      .populate('lastWateredBy', 'displayName avatar')
      .populate('lastSunlightBy', 'displayName avatar');

    res.status(200).json({ 
      success: true, 
      message: `Đã chạy cheat: ${action}`, 
      data: populated,
      expRequired: getExpRequired(populated.level)
    });
  } catch (error) {
    console.error('devCheat error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/tree/spray-pest
const sprayPest = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });

    if (!tree.hasPest) {
      return res.status(400).json({ success: false, message: 'Cây đang khoẻ mạnh, không có sâu!' });
    }

    if (tree.pesticides <= 0) {
      return res.status(400).json({ success: false, message: 'Bạn không có Thuốc trừ sâu. Hãy mua trong Cửa hàng!' });
    }

    tree.pesticides -= 1;
    tree.hasPest = false;
    tree.pestSpawnedAt = null;
    tree.lastPestDamageAt = null;
    
    // Thưởng 5 EXP vì đã cứu cây
    const expChange = 5;
    tree.exp = Math.max(0, tree.exp + expChange);
    tree.dailyExp += expChange;

    await tree.save();

    const populated = await LoveTree.findById(tree._id)
      .populate('lastWateredBy', 'displayName avatar')
      .populate('lastSunlightBy', 'displayName avatar');

    res.status(200).json({ 
      success: true, 
      data: populated, 
      message: 'Đã diệt sạch sâu bọ! Cây được cộng 5 EXP.', 
      expRequired: getExpRequired(populated.level) 
    });
  } catch (err) {
    console.error('sprayPest error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/tree/pull-weed
const pullWeed = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });

    if (tree.weedCount <= 0) {
      return res.status(400).json({ success: false, message: 'Gốc cây sạch sẽ, không có cỏ dại!' });
    }

    tree.weedCount -= 1;
    if (tree.weedCount === 0) {
      tree.weedSpawnedAt = null;
    }
    
    // Thưởng 5 EXP vì đã nhổ cỏ
    const expChange = 5;
    tree.exp = Math.max(0, tree.exp + expChange);
    tree.dailyExp += expChange;

    await tree.save();

    const populated = await LoveTree.findById(tree._id)
      .populate('lastWateredBy', 'displayName avatar')
      .populate('lastSunlightBy', 'displayName avatar');

    res.status(200).json({ 
      success: true, 
      data: populated, 
      message: 'Đã nhổ 1 cụm cỏ dại! Cây được cộng 5 EXP.', 
      expRequired: getExpRequired(populated.level) 
    });
  } catch (err) {
    console.error('pullWeed error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/tree/plant
const plantTree = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });
    }

    if (tree.isPlanted) {
      return res.status(400).json({ success: false, message: 'Cây đã được trồng rồi' });
    }

    const now = new Date();
    tree.isPlanted = true;
    tree.level = 1;
    tree.exp = 0;
    tree.waterLevel = 50;
    tree.sunlightLevel = 50;
    tree.lastWateredAt = now;
    tree.lastSunlightAt = now;
    tree.lastDailyExpResetAt = now;
    tree.isWithered = false;
    tree.witherReason = null;
    tree.dailyExp = 0;
    
    // reset interactions
    tree.userInteractions = tree.users.map(u => ({
      user: u,
      lastActionAt: null,
      lastWateredAt: null,
      lastSunlightAt: null
    }));

    await tree.save();

    res.status(200).json({ success: true, data: tree, message: 'Đã trồng cây thành công!', expRequired: getExpRequired(tree.level) });
  } catch (error) {
    console.error('plantTree error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', data: null });
  }
};

// POST /api/tree/harvest-stone
const harvestStone = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy cây' });

    if (tree.level < 5 || tree.exp < getExpRequired(5)) {
      return res.status(400).json({ success: false, message: 'Cây chưa đạt cấp tối đa và đầy EXP!' });
    }

    tree.loveStones = (tree.loveStones || 0) + 1;
    tree.isPlanted = false; // Về trạng thái hạt giống
    tree.level = 1;
    tree.exp = 0;
    tree.waterLevel = 50;
    tree.sunlightLevel = 50;
    tree.dailyExp = 0;
    tree.isWithered = false;
    tree.witherReason = null;
    tree.hasPest = false;
    tree.weedCount = 0;
    tree.activeWeather = 'none';
    tree.hasTreeProp = false;

    await tree.save();

    res.status(200).json({ success: true, data: tree, message: 'Thu hoạch thành công 1 Love Stone! 💎' });
  } catch (error) {
    console.error('harvestStone error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/tree/use-stone
const useStone = async (req, res) => {
  try {
    let tree = await LoveTree.findOne({ users: { $in: [req.user.id] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin' });

    if (!tree.loveStones || tree.loveStones <= 0) {
      return res.status(400).json({ success: false, message: 'Bạn không có Love Stone nào!' });
    }

    tree.loveStones -= 1;
    await tree.save();

    res.status(200).json({ success: true, data: tree, message: 'Đã đổi Love Stone lấy một buổi hẹn hò! 🍷🥩' });
  } catch (error) {
    console.error('useStone error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = {
  getTree,
  plantTree,
  interactTree,
  reviveTree,
  addReward,
  buyItem,
  usePotion,
  useProp,
  restoreStreak,
  resetStreak,
  devCheat,
  sprayPest,
  pullWeed,
  harvestStone,
  useStone,
};
