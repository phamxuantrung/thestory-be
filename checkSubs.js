const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const users = await User.find({}, 'username pushSubscriptions');
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  })
  .catch(console.error);
