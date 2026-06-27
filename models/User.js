const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: '',
      maxLength: 300,
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
      required: true,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    isAngry: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    anniversaryDate: {
      type: Date,
      default: null,
    },
    birthday: {
      type: Date,
      default: null,
    },
    partnerHobbies: [{
      category: { type: String, default: 'other' },
      text: { type: String, required: true },
    }],
    dailyMessage: {
      type: String,
      default: '',
    },
    dailyMessageDate: {
      type: Date,
      default: null,
    },
    chatClearedAt: {
      type: Date,
      default: null,
    },
    heart: {
      type: Number,
      default: 0,
    },
    dailySpinAssignedDate: {
      type: String,
      default: null,
    },
    dailySpinCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
