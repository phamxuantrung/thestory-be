const mongoose = require('mongoose');

const loveTreeSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isPlanted: {
      type: Boolean,
      default: false,
    },
    level: {
      type: Number,
      default: 1, // 1: Hạt giống, 2: Mầm non, 3: Cây nhỏ, 4: Cây trưởng thành, 5: Ra hoa
    },
    exp: {
      type: Number,
      default: 0,
    },
    streak: {
      type: Number,
      default: 0,
    },
    waterLevel: {
      type: Number,
      default: 50, // Khởi đầu 50%
      max: 100,
    },
    sunlightLevel: {
      type: Number,
      default: 50, // Khởi đầu 50%
      max: 100,
    },
    isWithered: {
      type: Boolean,
      default: false,
    },
    witherReason: {
      type: String,
      default: null,
    },
    fertilizers: {
      type: Number,
      default: 0,
    },
    coins: {
      type: Number,
      default: 0,
    },
    shields: {
      type: Number,
      default: 0,
    },
    growthPotions: {
      type: Number,
      default: 0,
    },
    pesticides: {
      type: Number,
      default: 0,
    },
    questRefreshData: {
      week: { type: String, default: '' },
      count: { type: Number, default: 0 }
    },
    hasPest: {
      type: Boolean,
      default: false,
    },
    pestSpawnedAt: {
      type: Date,
      default: null,
    },
    lastPestDamageAt: {
      type: Date,
      default: null,
    },
    dailyExp: {
      type: Number,
      default: 0,
    },
    activeWeather: {
      type: String,
      enum: ['none', 'storm', 'drought'],
      default: 'none',
    },
    weatherStartedAt: {
      type: Date,
      default: null,
    },
    lastWeatherDamageAt: {
      type: Date,
      default: null,
    },
    treeProps: {
      type: Number,
      default: 0, // Số cọc chống cây trong kho
    },
    hasTreeProp: {
      type: Boolean,
      default: false, // Trạng thái đang dùng cọc
    },
    droughtWaterings: {
      type: Number,
      default: 0, // Đếm số lần tưới nước trong lúc hạn hán (yêu cầu 3 lần)
    },
    lastDailyExpResetAt: {
      type: Date,
      default: null,
    },
    lastWateredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastSunlightBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastWateredAt: {
      type: Date,
      default: null,
    },
    lastSunlightAt: {
      type: Date,
      default: null,
    },
    userInteractions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        lastActionAt: { type: Date, default: null },
        lastWateredAt: { type: Date, default: null },
        lastSunlightAt: { type: Date, default: null },
      }
    ],
    isStreakBroken: {
      type: Boolean,
      default: false,
    },
    streakBrokenAt: {
      type: Date,
      default: null,
    },
    lastStreakUpdateAt: {
      type: Date,
      default: null,
    },
    weedCount: {
      type: Number,
      default: 0,
      max: 3,
    },
    weedSpawnedAt: {
      type: Date,
      default: null,
    },
    loveStones: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoveTree', loveTreeSchema);
