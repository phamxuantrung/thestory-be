const mongoose = require('mongoose');
const LoveTree = require('./models/LoveTree');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const trees = await LoveTree.find({}).populate('users');
    for (const tree of trees) {
        console.log("Tree ID:", tree._id);
        console.log("Level:", tree.level);
        console.log("Streak:", tree.streak);
        console.log("Is Broken:", tree.isStreakBroken);
        console.log("Last Streak Update:", tree.lastStreakUpdateAt);
        console.log("Broken At:", tree.streakBrokenAt);
        console.log("Users:", tree.users.map(u => u._id));
        console.log("User Interactions:");
        for (const ui of tree.userInteractions) {
            console.log(`  User: ${ui.user}, LastActionAt: ${ui.lastActionAt}`);
        }
        console.log("-------------------");
    }
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
