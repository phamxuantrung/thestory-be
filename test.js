const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  const User = require('./models/User');
  const jwt = require('jsonwebtoken');
  const user = await User.findOne({ partnerId: { $ne: null } });
  if (user) {
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    try {
      const res = await fetch('http://localhost:5000/api/quests/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('ERROR RESPONSE:', data);
      } else {
        console.log('SUCCESS:', data);
      }
    } catch (err) {
      console.error('FETCH ERROR:', err);
    }
  } else {
    console.log('No user found');
  }
  mongoose.disconnect();
});
