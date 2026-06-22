const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:thestory-app@email.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = webpush;
