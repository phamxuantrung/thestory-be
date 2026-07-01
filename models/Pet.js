const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  speciesId: { type: String, required: true },
  name: { type: String, required: true },
  emoji: { type: String, required: true },
  rarity: { type: String, required: true },
  level: { type: Number, default: 1 },
  exp: { type: Number, default: 0 },
  stats: {
    str: { type: Number, default: 0 },
    agi: { type: Number, default: 0 },
    luk: { type: Number, default: 0 },
    int: { type: Number, default: 0 }
  },
  care: {
    happiness: { type: Number, default: 100 },
    fullness: { type: Number, default: 100 },
    cleanliness: { type: Number, default: 100 },
    maxHappiness: { type: Number, default: 100 },
    maxFullness: { type: Number, default: 100 },
    maxCleanliness: { type: Number, default: 100 },
    lastUpdate: { type: Date, default: Date.now },
    lastPlayed: { type: Date, default: null },
    lastBathed: { type: Date, default: null }
  },
  status: { type: String, enum: ['idle', 'exploring'], default: 'idle' },
  expeditionStart: { type: Date, default: null },
  expeditionEnd: { type: Date, default: null },
  destinationId: { type: String, default: null },
  pending: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Pet', petSchema);
