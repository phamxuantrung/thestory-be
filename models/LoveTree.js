const mongoose = require('mongoose');

const loveTreeSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
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
    fertilizers: {
      type: Number,
      default: 0,
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
      }
    ],
    lastStreakUpdateAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoveTree', loveTreeSchema);
