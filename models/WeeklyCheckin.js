const mongoose = require('mongoose');

const checkinDaySchema = new mongoose.Schema({
  dayOfWeek: { type: Number, required: true }, // 0=Mon, 1=Tue, ... 6=Sun
  heartReward: { type: Number, required: true },
  checkedIn: { type: Boolean, default: false },
  checkedAt: { type: Date, default: null },
}, { _id: false });

const weeklyCheckinSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  weekIdentifier: {
    type: String,
    required: true, // e.g. "2025-W26"
  },
  days: [checkinDaySchema],
}, { timestamps: true });

weeklyCheckinSchema.index({ userId: 1, weekIdentifier: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyCheckin', weeklyCheckinSchema);
