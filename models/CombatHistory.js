const mongoose = require('mongoose');

const combatHistorySchema = new mongoose.Schema(
  {
    attackerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    defenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isAttackerWin: {
      type: Boolean,
      required: true
    },
    reward: {
      type: Number,
      required: true,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('CombatHistory', combatHistorySchema);
