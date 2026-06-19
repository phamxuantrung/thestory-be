const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();
const { sendPushNotification } = require('./utils/webPush');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const user = await User.findOne({ username: 'phuong_dung' });
    if (user && user.pushSubscriptions) {
      console.log(`Sending to ${user.pushSubscriptions.length} subs...`);
      const results = await sendPushNotification(user.pushSubscriptions, {
        title: 'Test Notification',
        body: 'This is a test from script',
        url: '/'
      });
      console.log('Results:', results);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
