const { isSameDay, getMaxLevel, getVNDate } = require('../utils/treeUtils');

const evaluateTreeState = async (tree, io) => {
  if (!tree.isPlanted) return false;

  const now = new Date();
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
    isTreeChanged = true;

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
    if (tree.activeWeather === 'drought') {
      const anyFailed = tree.userInteractions.some(ui => (ui.droughtWaterings || 0) < 3);
      if (anyFailed) {
        shouldWither = true;
        tree.witherReason = 'Cây đã chết khô do có người không tưới đủ 3 lần trong ngày Hạn hán!';
      }
    }

    // End weather randomly or if withered
    if (tree.activeWeather !== 'none') {
      if (shouldWither || Math.random() < 0.40) {
        tree.activeWeather = 'none';
        tree.hasTreeProp = false;
        tree.droughtWaterings = 0;
        tree.userInteractions.forEach(ui => ui.droughtWaterings = 0);
      }
    } else if (!tree.isWithered && !shouldWither) {
      // Spawn Weather: 15% storm, 15% drought (ONLY IF AT 0:xx VN TIME)
      const currentHour = getVNDate(now).getHours();
      if (currentHour === 0) {
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
          tree.userInteractions.forEach(ui => ui.droughtWaterings = 0);
        }
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
  } else if (!tree.lastDailyExpResetAt) {
    tree.lastDailyExpResetAt = now;
    isTreeChanged = true;
  }

  if (!tree.isWithered && shouldWither) {
    tree.isWithered = true;
    tree.hasPest = false; // Xoá sâu bọ khi cây héo
    isTreeChanged = true;
  }

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  if (tree.level < getMaxLevel(tree.treeType) && tree.streak > 0 && tree.lastStreakUpdateAt && !isSameDay(tree.lastStreakUpdateAt, now) && !isSameDay(tree.lastStreakUpdateAt, yesterday)) {
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
    if (io && tree.users) {
      tree.users.forEach(uId => {
        io.to(uId.toString()).emit('tree:update');
      });
    }
  }

  return isTreeChanged;
};

module.exports = {
  evaluateTreeState
};
