const mongoose = require('mongoose');

const dailyNumerologySchema = new mongoose.Schema(
  {
    coupleId: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
      // Format: "YYYY-MM-DD"
    },
    energyNumber: {
      type: Number,
      required: true,
    },
    meaning: {
      type: String,
      required: true,
    },
    advice: {
      type: String,
      required: true,
    },
    actionPrompt: {
      type: String,
      required: true,
    }
  },
  { timestamps: true }
);

dailyNumerologySchema.index({ coupleId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyNumerology', dailyNumerologySchema);
