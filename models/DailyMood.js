const mongoose = require('mongoose');

const dailyMoodSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    mood: {
      type: String,
      enum: ['happy', 'very_happy', 'sad', 'angry'],
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Mỗi người dùng chỉ có 1 mood mỗi ngày
dailyMoodSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyMood', dailyMoodSchema);
