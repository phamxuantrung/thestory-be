const mongoose = require('mongoose');
const User = require('./models/User');
const Pet = require('./models/Pet');

mongoose.connect('mongodb://localhost:27017/')
  .then(async () => {
    try {
      // Find a user
      const user = await User.findOne();
      if (!user) {
        console.log("No user found");
        process.exit(1);
      }
      
      // Attempt to buy a pet manually
      const price = 50;
      const tier = 1;
      
      const RARITY = {
        common:    { mult: 1.0 },
        rare:      { mult: 1.25 },
        epic:      { mult: 1.6 },
        legendary: { mult: 2.1 },
      };
      const TIER_RANGE = { 1: [15, 35], 2: [25, 45], 3: [35, 55] };
      const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
      function generateStats(tier, rarityMult) {
        const [min, max] = TIER_RANGE[tier];
        const gen = () => Math.min(100, Math.round(randInt(min, max) * rarityMult));
        return { str: gen(), agi: gen(), luk: gen(), int: gen() };
      }
      
      const stats = generateStats(tier, RARITY['common'].mult);
      
      const pet = await Pet.create({
        userId: user._id,
        speciesId: 'fox',
        name: 'Cáo Lửa',
        emoji: '🦊',
        rarity: 'common',
        level: 1,
        exp: 0,
        stats,
        care: { happiness: 100, fullness: 100, cleanliness: 100, lastUpdate: Date.now() },
        status: 'idle'
      });
      console.log('Success:', pet);
    } catch (err) {
      console.error('ERROR:', err);
    }
    process.exit(0);
  });
