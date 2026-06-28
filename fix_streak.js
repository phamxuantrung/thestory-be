const mongoose = require('mongoose');
require('dotenv').config();
const LoveTree = require('./models/LoveTree');

async function fixStreak() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to DB');
    // Find the tree (assuming there is only one tree in dev environment for the user)
    // Or we can just find the most recently active tree
    const tree = await LoveTree.findOne().sort({ updatedAt: -1 });
    
    if (tree) {
      tree.streak = 9;
      // also ensure it's not broken
      tree.isStreakBroken = false;
      tree.streakBrokenAt = null;
      
      await tree.save();
      console.log('Streak successfully updated to 9 for tree:', tree._id);
    } else {
      console.log('No tree found');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.disconnect();
  }
}

fixStreak();
