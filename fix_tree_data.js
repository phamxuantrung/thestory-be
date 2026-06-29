const mongoose = require('mongoose');
const LoveTree = require('./models/LoveTree');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const trees = await LoveTree.find({});
    for (const tree of trees) {
        // Fix duplicates in userInteractions
        const uniqueUIs = [];
        for (const ui of tree.userInteractions) {
            const existing = uniqueUIs.find(u => u.user.toString() === ui.user.toString());
            if (existing) {
                if (ui.lastActionAt && (!existing.lastActionAt || ui.lastActionAt > existing.lastActionAt)) {
                    existing.lastActionAt = ui.lastActionAt;
                }
            } else {
                uniqueUIs.push({ ...ui.toObject() });
            }
        }
        
        tree.userInteractions = uniqueUIs;
        
        // Since they watered today and yesterday, their streak should be 10 and not broken.
        // And lastStreakUpdateAt should be today.
        tree.streak = 10;
        tree.isStreakBroken = false;
        tree.streakBrokenAt = null;
        tree.lastStreakUpdateAt = new Date(); // Update to today so it won't break tomorrow if they already watered today
        
        await tree.save();
        console.log(`Fixed tree ${tree._id}: cleaned duplicates, updated streak to 10`);
    }
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
