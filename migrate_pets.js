const mongoose = require('mongoose');
const Pet = require('./models/Pet');

mongoose.connect('mongodb://localhost:27017/')
  .then(async () => {
    await Pet.updateMany(
      { rarity: { $exists: false } },
      { $set: { rarity: 'common', emoji: '🐾', speciesId: 'fox' } }
    );
    console.log('Migration complete');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
