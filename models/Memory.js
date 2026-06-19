const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    date: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      enum: ['trip', 'date', 'activity', 'milestone', 'daily', 'special'],
      default: 'daily',
    },
    images: [
      {
        url: { type: String, required: true },
        caption: { type: String, default: '' },
      },
    ],
    mood: {
      type: String,
      enum: ['happy', 'romantic', 'excited', 'peaceful', 'nostalgic', 'fun'],
      default: 'happy',
    },
    isShared: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Memory', memorySchema);
