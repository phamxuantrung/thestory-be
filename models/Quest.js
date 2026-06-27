const mongoose = require('mongoose');

const questSchema = new mongoose.Schema(
  {
    coupleId: {
      type: String,
      required: true,
    },
    weekIdentifier: {
      type: String,
      required: true,
      // Format: "YYYY-WW" (Ví dụ: "2026-25" cho tuần 25 năm 2026)
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    expReward: {
      type: Number,
      default: 50,
    },
    coinReward: {
      type: Number,
      default: 10,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'expired'],
      default: 'pending',
    },
    acceptedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    completedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Một cặp đôi chỉ có 1 nhiệm vụ chung trong 1 tuần (hoặc danh sách nhiệm vụ được lưu ở đâu đó. Ở đây ta giả sử 1 tuần giao 1 list các quest, nên weekIdentifier + coupleId sẽ có nhiều quests, nhưng ta có thể lấy theo tuần).
questSchema.index({ coupleId: 1, weekIdentifier: 1 });

module.exports = mongoose.model('Quest', questSchema);
