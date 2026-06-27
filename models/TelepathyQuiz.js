const mongoose = require('mongoose');

const telepathyQuizSchema = new mongoose.Schema(
  {
    coupleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoveTree',
      required: true,
    },
    date: {
      type: String,
      required: true,
      // Format: "YYYY-MM-DD"
    },
    optionA: {
      type: String,
      required: true,
    },
    optionB: {
      type: String,
      required: true,
    },
    answers: {
      type: Map,
      of: String, // 'A' or 'B', keyed by userId
      default: {},
    },
    isMatched: {
      type: Boolean,
      default: false,
    },
    rewarded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

telepathyQuizSchema.index({ coupleId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TelepathyQuiz', telepathyQuizSchema);
