const mongoose = require('mongoose');

const heartTaskSchema = new mongoose.Schema({
  taskId: { type: String, required: true },       // key từ pool
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'other' },   // chat, memory, mood, letter, location, store, game, login
  icon: { type: String, default: 'star' },
  heartReward: { type: Number, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
}, { _id: false });

const weeklyHeartTasksSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  weekIdentifier: {
    type: String,
    required: true, // e.g. "2025-W26"
  },
  tasks: [heartTaskSchema],
}, { timestamps: true });

weeklyHeartTasksSchema.index({ userId: 1, weekIdentifier: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyHeartTasks', weeklyHeartTasksSchema);
