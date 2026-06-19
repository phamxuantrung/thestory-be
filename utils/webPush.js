const webpush = require('web-push');

// Config
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:test@test.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️ Missing VAPID keys for web-push');
}

const sendPushNotification = async (subscriptions, payload) => {
  if (!subscriptions || subscriptions.length === 0) return;
  
  const payloadString = JSON.stringify(payload);
  
  const promises = subscriptions.map(sub => 
    webpush.sendNotification(sub, payloadString).catch(err => {
      console.error('Push notification failed for a subscription', err);
      // We could also remove the expired subscription from the DB here
      if (err.statusCode === 410 || err.statusCode === 404) {
        return { expired: true, subscription: sub };
      }
      return null;
    })
  );

  const results = await Promise.all(promises);
  return results.filter(r => r && r.expired);
};

module.exports = { sendPushNotification };
