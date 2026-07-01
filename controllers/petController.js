const Pet = require('../models/Pet');
const User = require('../models/User');
const CombatHistory = require('../models/CombatHistory');
const { RARITY, SPECIES, FOODS, DESTINATIONS, MAX_PETS, ITEMS } = require('../config/gameConfig');

const CARE_THRESHOLD = 40;

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (v, max) => Math.max(0, Math.min(max, Math.round(v)));

function rollRarity() {
  const r = Math.random() * 100;
  if (r < 4) return "legendary";
  if (r < 17) return "epic";
  if (r < 45) return "rare";
  return "common";
}

function generateStats(baseStats, rarityMult) {
  const gen = (val) => Math.min(100, Math.round((val + randInt(0, 5)) * rarityMult));
  return { 
    str: gen(baseStats.str), 
    agi: gen(baseStats.agi), 
    luk: gen(baseStats.luk), 
    int: gen(baseStats.int) 
  };
}

function statScoreOf(pet) {
  const s = pet.stats;
  return (s.str + s.agi + s.luk + s.int) / 4;
}

function expToNext(level) {
  return 30 + level * 25;
}

function applyExp(pet, exp) {
  let leveled = false;
  pet.exp += exp;
  while (pet.exp >= expToNext(pet.level)) {
    pet.exp -= expToNext(pet.level);
    pet.level += 1;
    pet.stats.str = Math.min(100, pet.stats.str + randInt(1, 3));
    pet.stats.agi = Math.min(100, pet.stats.agi + randInt(1, 3));
    pet.stats.luk = Math.min(100, pet.stats.luk + randInt(1, 3));
    pet.stats.int = Math.min(100, pet.stats.int + randInt(1, 3));
    leveled = true;
  }
  return leveled;
}

function computeReward(pet, dest) {
  const score = statScoreOf(pet);
  const base = randInt(dest.rewardMin, dest.rewardMax);
  const mult = 0.7 + (score / 100) * 0.8;
  let coins = Math.round(base * mult);
  let bonus = false;
  if (Math.random() * 100 < pet.stats.luk * 0.4) {
    coins += Math.round(base * 0.35);
    bonus = true;
  }
  const expGain = Math.round(dest.durationHours * 15);
  return { coins, expGain, bonus };
}

function getCurrentCare(pet, now) {
  if (!pet.care) return { happiness: 100, fullness: 100, cleanliness: 100 };
  if (pet.status === "exploring") return pet.care;
  const hours = Math.max(0, (now - new Date(pet.care.lastUpdate).getTime()) / 3600000);
  
  const speciesDef = SPECIES.find(s => s.id === pet.speciesId);
  const decay = speciesDef?.decay || { f: 5, h: 4, c: 3 };

  return {
    happiness: clamp(pet.care.happiness - decay.h * hours, pet.care.maxHappiness || 100),
    fullness: clamp(pet.care.fullness - decay.f * hours, pet.care.maxFullness || 100),
    cleanliness: clamp(pet.care.cleanliness - decay.c * hours, pet.care.maxCleanliness || 100),
  };
}

function isEligibleForExpedition(pet, now) {
  if (pet.status !== "idle") return false;
  const c = getCurrentCare(pet, now);
  return c.happiness >= CARE_THRESHOLD && c.fullness >= CARE_THRESHOLD && c.cleanliness >= CARE_THRESHOLD;
}

// Lấy danh sách thú cưng của người dùng hiện tại
const getPets = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const pets = await Pet.find({ userId: req.user.id });
    res.status(200).json({ success: true, pets, defenseTeam: user.defenseTeam || [] });
  } catch (error) {
    console.error('getPets error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Mua thú cưng
const buyPet = async (req, res) => {
  try {
    const { speciesId, name, emoji } = req.body;
    const user = await User.findById(req.user.id);
    
    // Kiểm tra giới hạn số lượng thú cưng
    const currentPetsCount = await Pet.countDocuments({ userId: req.user.id });
    if (currentPetsCount >= MAX_PETS) {
      return res.status(400).json({ success: false, message: 'Vườn đã đầy, không thể mua thêm!' });
    }

    const speciesDef = SPECIES.find(s => s.id === speciesId);
    if (!speciesDef) return res.status(400).json({ success: false, message: 'Loài thú không tồn tại' });
    
    if (user.heart < speciesDef.price) {
      return res.status(400).json({ success: false, message: 'Không đủ Heart' });
    }

    user.heart -= speciesDef.price;
    await user.save();

    const rarity = rollRarity();
    const stats = generateStats(speciesDef.baseStats, RARITY[rarity].mult);

    const pet = await Pet.create({
      userId: user._id,
      speciesId,
      name: name || speciesDef.name,
      emoji: emoji || speciesDef.emoji,
      rarity,
      level: 1,
      exp: 0,
      stats,
      care: { 
        happiness: speciesDef.maxCare.h, 
        fullness: speciesDef.maxCare.f, 
        cleanliness: speciesDef.maxCare.c,
        maxHappiness: speciesDef.maxCare.h,
        maxFullness: speciesDef.maxCare.f,
        maxCleanliness: speciesDef.maxCare.c,
        lastUpdate: Date.now() 
      },
      status: 'idle'
    });

    res.status(200).json({ success: true, pet, heart: user.heart });
  } catch (error) {
    console.error('buyPet error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Đổi tên thú cưng
const renamePet = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    const pet = await Pet.findOne({ _id: id, userId: req.user.id });
    if (!pet) return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng' });

    pet.name = name.trim().slice(0, 24);
    await pet.save();

    res.status(200).json({ success: true, pet });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Bán thú cưng
const sellPet = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pet = await Pet.findOne({ _id: id, userId: req.user.id });
    if (!pet) return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng' });
    if (pet.status === 'exploring') return res.status(400).json({ success: false, message: 'Không thể bán thú cưng đang đi thám hiểm' });

    const speciesDef = SPECIES.find(s => s.id === pet.speciesId);
    if (!speciesDef) return res.status(400).json({ success: false, message: 'Dữ liệu loài bị lỗi' });

    // Tiền Bán = Giá Gốc * (40% + (Level - 1) * 10%)
    const sellRatio = 0.4 + (pet.level - 1) * 0.1;
    const sellValue = Math.floor(speciesDef.price * sellRatio);

    await Pet.findByIdAndDelete(pet._id);

    const user = await User.findById(req.user.id);
    user.heart += sellValue;
    await user.save();

    res.status(200).json({ success: true, message: 'Đã thả thú cưng về rừng', heart: user.heart, sellValue });
  } catch (error) {
    console.error('sellPet error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Chăm sóc thú cưng
const carePet = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, foodId } = req.body; // 'feed', 'play', 'bathe'
    
    const pet = await Pet.findOne({ _id: id, userId: req.user.id });
    if (!pet) return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng' });
    if (pet.status === 'exploring') return res.status(400).json({ success: false, message: 'Thú cưng đang đi thám hiểm' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Lỗi người dùng' });

    const current = getCurrentCare(pet, Date.now());
    let updated = { ...current };
    const now = Date.now();
    
    if (type === "feed") {
      const foodDef = FOODS.find(f => f.id === foodId);
      if (!foodId || !foodDef) return res.status(400).json({ success: false, message: 'Thức ăn không hợp lệ' });
      
      const foodItem = user.petFoods.find(f => f.foodId === foodId);
      if (!foodItem || foodItem.quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Bạn không có đủ thức ăn này' });
      }

      // Trừ số lượng thức ăn
      foodItem.quantity -= 1;
      
      updated.fullness = clamp(current.fullness + foodDef.fullness, pet.care.maxFullness || 100);
      updated.happiness = clamp(current.happiness + foodDef.happiness, pet.care.maxHappiness || 100);
      
      await user.save();
    } else if (type === "play") {
      if (pet.care.lastPlayed && (now - new Date(pet.care.lastPlayed).getTime()) < 3600000) {
        return res.status(400).json({ success: false, message: 'Thú cưng đang mệt, hãy vuốt ve sau nhé!' });
      }
      updated.happiness = clamp(current.happiness + 30, pet.care.maxHappiness || 100);
      updated.fullness = clamp(current.fullness - 5, pet.care.maxFullness || 100);
      updated.cleanliness = clamp(current.cleanliness - 4, pet.care.maxCleanliness || 100);
      updated.lastPlayed = new Date(now);
    } else if (type === "bathe") {
      if (pet.care.lastBathed && (now - new Date(pet.care.lastBathed).getTime()) < 14400000) {
        return res.status(400).json({ success: false, message: 'Thú cưng vừa mới tắm xong mà!' });
      }
      updated.cleanliness = clamp(current.cleanliness + 40, pet.care.maxCleanliness || 100);
      updated.lastBathed = new Date(now);
    }

    pet.care = { ...pet.care, ...updated, lastUpdate: now };
    await pet.save();

    res.status(200).json({ success: true, pet, petFoods: user.petFoods });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Mua thức ăn
const buyFood = async (req, res) => {
  try {
    const { foodId, amount } = req.body;
    const qty = parseInt(amount) || 1;
    
    const foodDef = FOODS.find(f => f.id === foodId);
    if (!foodDef || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
    }

    const totalCost = foodDef.price * qty;

    const user = await User.findById(req.user.id);
    if (user.heart < totalCost) {
      return res.status(400).json({ success: false, message: 'Không đủ Heart' });
    }

    user.heart -= totalCost;

    const existingFood = user.petFoods.find(f => f.foodId === foodId);
    if (existingFood) {
      existingFood.quantity += qty;
    } else {
      user.petFoods.push({ foodId, quantity: qty });
    }

    await user.save();
    res.status(200).json({ success: true, heart: user.heart, petFoods: user.petFoods });
  } catch (error) {
    console.error('buyFood error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Bắt đầu thám hiểm
const startExpedition = async (req, res) => {
  try {
    const { id } = req.params;
    const { destinationId } = req.body;
    
    const dest = DESTINATIONS.find(d => d.id === destinationId);
    if (!dest) return res.status(400).json({ success: false, message: 'Điểm đến không hợp lệ' });

    const pet = await Pet.findOne({ _id: id, userId: req.user.id });
    if (!pet) return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng' });
    
    const now = Date.now();
    if (!isEligibleForExpedition(pet, now)) {
      return res.status(400).json({ success: false, message: 'Thú cưng chưa sẵn sàng' });
    }

    const reward = computeReward(pet, dest);
    const frozenCare = getCurrentCare(pet, now);

    pet.care = { ...frozenCare, lastUpdate: now };
    pet.status = 'exploring';
    pet.destinationId = dest.id;
    pet.expeditionStart = now;
    pet.expeditionEnd = new Date(now + dest.durationHours * 3600000);
    pet.pending = reward;

    await pet.save();
    res.status(200).json({ success: true, pet });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Thu hoạch thám hiểm
const collectExpedition = async (req, res) => {
  try {
    const { id } = req.params;
    const pet = await Pet.findOne({ _id: id, userId: req.user.id });
    
    if (!pet || pet.status !== 'exploring' || !pet.pending) {
      return res.status(400).json({ success: false, message: 'Thú cưng không ở trạng thái thám hiểm' });
    }

    if (Date.now() < new Date(pet.expeditionEnd).getTime()) {
      return res.status(400).json({ success: false, message: 'Thám hiểm chưa hoàn thành' });
    }

    const dest = DESTINATIONS.find(d => d.id === pet.destinationId);
    const h = dest ? dest.durationHours : 2;
    const speciesDef = SPECIES.find(s => s.id === pet.speciesId);

    // Xử lý tử vong
    if (dest && speciesDef) {
      const baseDanger = dest.baseDanger || 0;
      const fragility = speciesDef.fragility || 1.0;
      const deathChance = Math.max(0, baseDanger * fragility * (1 - pet.level * 0.05));
      if (Math.random() < deathChance) {
        await Pet.findByIdAndDelete(pet._id);
        return res.status(200).json({ success: true, dead: true, petName: pet.name });
      }
    }
    
    const careAfterTrip = {
      happiness: clamp((pet.care.happiness) + 10 - 2 * h, pet.care.maxHappiness || 100),
      fullness: clamp((pet.care.fullness) - 9 * h, pet.care.maxFullness || 100),
      cleanliness: clamp((pet.care.cleanliness) - 6 * h, pet.care.maxCleanliness || 100),
      lastUpdate: Date.now(),
    };

    const reward = pet.pending;
    const leveled = applyExp(pet, reward.expGain);

    pet.status = 'idle';
    pet.destinationId = null;
    pet.expeditionStart = null;
    pet.expeditionEnd = null;
    pet.pending = null;
    pet.care = careAfterTrip;

    await pet.save();

    const user = await User.findById(req.user.id);
    user.heart += reward.coins;
    
    let foundFoods = [];
    if (speciesDef && speciesDef.findableFoods && speciesDef.findableFoods.length > 0) {
      const dropRate = speciesDef.dropRate || 0.5;
      if (Math.random() < dropRate) {
        const numItems = Math.random() < 0.2 ? 2 : 1;
        const foodId = speciesDef.findableFoods[Math.floor(Math.random() * speciesDef.findableFoods.length)];
        foundFoods.push({ foodId, quantity: numItems });
        
        const existingFood = user.petFoods.find(f => f.foodId === foodId);
        if (existingFood) {
          existingFood.quantity += numItems;
        } else {
          user.petFoods.push({ foodId, quantity: numItems });
        }
      }
    }
    
    await user.save();

    res.status(200).json({ success: true, pet, heart: user.heart, reward, leveled, foundFoods, petFoods: user.petFoods });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Dev Mode Handler
const devAction = async (req, res) => {
  try {
    const { action } = req.body;
    const user = await User.findById(req.user.id);
    const pets = await Pet.find({ userId: req.user.id });

    if (action === 'add_hearts') {
      user.heart += 5000;
      await user.save();
    } else if (action === 'add_food') {
      FOODS.forEach(food => {
        const item = user.petFoods.find(f => f.foodId === food.id);
        if (item) item.quantity += 5;
        else user.petFoods.push({ foodId: food.id, quantity: 5 });
      });
      await user.save();
    } else if (action === 'level_up') {
      for (let pet of pets) {
        applyExp(pet, 1000);
        await pet.save();
      }
    } else if (action === 'skip_expedition') {
      for (let pet of pets) {
        if (pet.status === 'exploring' && pet.expeditionEnd) {
          pet.expeditionEnd = Date.now();
          await pet.save();
        }
      }
    } else if (action === 'reset_cooldown') {
      for (let pet of pets) {
        if (pet.care) {
          pet.care.lastPlayed = null;
          pet.care.lastBathed = null;
          pet.markModified('care');
        }
        await pet.save();
      }
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    res.status(200).json({ success: true, message: 'Thành công!', userHeart: user.heart });
  } catch (error) {
    console.error('devAction error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Mới: Lấy thú cưng của người yêu
const getPartnerPets = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.partnerId) {
      return res.status(200).json({ success: true, pets: [], defenseTeam: [] }); // Không có gấu
    }
    const partner = await User.findById(user.partnerId);
    const pets = await Pet.find({ userId: user.partnerId });
    res.status(200).json({ success: true, pets, defenseTeam: partner.defenseTeam || [], partnerShieldUntil: partner.shieldUntil });
  } catch (error) {
    console.error('getPartnerPets error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Mới: Tính năng Thiết lập Đội Thủ
const setDefenseTeam = async (req, res) => {
  try {
    const { petIds } = req.body;
    if (!Array.isArray(petIds) || petIds.length > 5) {
      return res.status(400).json({ success: false, message: 'Đội hình tối đa 5 thú cưng' });
    }
    
    const pets = await Pet.find({ _id: { $in: petIds }, userId: req.user.id });
    if (pets.length !== petIds.length) {
      return res.status(400).json({ success: false, message: 'Có linh thú không hợp lệ' });
    }

    const user = await User.findById(req.user.id);
    user.defenseTeam = petIds;
    await user.save();

    res.status(200).json({ success: true, message: 'Lưu đội hình thành công' });
  } catch (error) {
    console.error('setDefenseTeam error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Mới: Tính năng Combat
const combatPets = async (req, res) => {
  try {
    const { myTeamIds } = req.body;
    const user = await User.findById(req.user.id);
    if (!user || !user.partnerId) return res.status(400).json({ success: false, message: 'Bạn chưa có cặp đôi để thách đấu!' });

    if (!Array.isArray(myTeamIds) || myTeamIds.length === 0 || myTeamIds.length > 5) {
      return res.status(400).json({ success: false, message: 'Đội hình xuất chiến không hợp lệ!' });
    }
    const now = Date.now();
    
    // Kiểm tra cooldown 24h
    if (user.lastCombatDate && (now - new Date(user.lastCombatDate).getTime() < 24 * 60 * 60 * 1000)) {
      return res.status(400).json({ success: false, message: 'Bạn cần đợi 24 giờ để có thể khiêu chiến tiếp!' });
    }
    // Lấy thông tin partner
    const partner = await User.findById(user.partnerId);
    if (!partner) return res.status(400).json({ success: false, message: 'Gấu của bạn không tồn tại!' });

    // Kiểm tra khiên bảo vệ
    if (partner.shieldUntil && new Date(partner.shieldUntil).getTime() > now) {
      return res.status(400).json({ success: false, message: 'Gấu đang được bảo vệ bởi Khiên. Không thể tấn công lúc này!' });
    }
    
    // Lấy các bé Team A theo đúng thứ tự
    const myPets = await Pet.find({ _id: { $in: myTeamIds }, userId: req.user.id });
    let teamA = [];
    for (let id of myTeamIds) {
      const p = myPets.find(x => x._id.toString() === id);
      if (p && p.status === 'idle') {
        const care = getCurrentCare(p, now);
        if (care.happiness >= 30 && care.fullness >= 30) {
           teamA.push(p);
        }
      }
    }

    if (teamA.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có thú cưng nào đủ thể lực để xuất chiến!' });
    }

    // Lấy thú cưng của Partner (Team B)
    await partner.populate('defenseTeam');
    let partnerPetsAll = await Pet.find({ userId: user.partnerId });
    
    let teamB = [];
    if (partner.defenseTeam && partner.defenseTeam.length > 0) {
       for (let p of partner.defenseTeam) {
         if (p && p._id && p.status === 'idle') teamB.push(p);
       }
    }
    
    if (teamB.length === 0) {
       // Tự động lấy tối đa 5 bé có stat tổng cao nhất và đang rảnh rỗi
       let idlePartnerPets = partnerPetsAll.filter(p => p.status === 'idle');
       idlePartnerPets.sort((a,b) => (b.stats.str+b.stats.agi+b.stats.int+b.stats.luk) - (a.stats.str+a.stats.agi+a.stats.int+a.stats.luk));
       teamB = idlePartnerPets.slice(0, 5);
    }

    if (teamB.length === 0) {
      return res.status(400).json({ success: false, message: 'Gấu của bạn chưa có linh thú nào rảnh rỗi để thủ thành lúc này!' });
    }

    // Init state cho từng bé
    const stateA = teamA.map((p, index) => ({
      _id: p._id,
      name: p.name,
      emoji: p.emoji,
      team: 'A',
      slot: index + 1,
      stats: p.stats,
      maxHp: Math.max(10, p.stats.str * 10 + p.stats.luk * 2),
      hp: Math.max(10, p.stats.str * 10 + p.stats.luk * 2),
      originalDoc: p
    }));

    const stateB = teamB.map((p, index) => ({
      _id: p._id,
      name: p.name,
      emoji: p.emoji,
      team: 'B',
      slot: index + 1,
      stats: p.stats,
      maxHp: Math.max(10, p.stats.str * 10 + p.stats.luk * 2),
      hp: Math.max(10, p.stats.str * 10 + p.stats.luk * 2),
      originalDoc: p
    }));

    let allFighters = [...stateA, ...stateB];
    let logs = [];
    let round = 1;

    // Trừ điểm Care của Team A trước
    for (let p of stateA) {
      const care = getCurrentCare(p.originalDoc, now);
      p.originalDoc.care = care;
      p.originalDoc.care.happiness = Math.max(0, p.originalDoc.care.happiness - 20);
      p.originalDoc.care.fullness = Math.max(0, p.originalDoc.care.fullness - 15);
      p.originalDoc.care.lastUpdate = new Date(now);
    }

    // Vòng lặp combat
    // Max 30 rounds để tránh lặp vô hạn
    while (round <= 30) {
      // Sort theo AGI mỗi round
      allFighters.sort((a, b) => b.stats.agi - a.stats.agi);

      for (let attacker of allFighters) {
        if (attacker.hp <= 0) continue; // Đã chết

        // Tìm mục tiêu (đối phương còn sống)
        const enemies = allFighters.filter(f => f.team !== attacker.team && f.hp > 0);
        if (enemies.length === 0) break; // Một phe đã chết hết

        let target;
        // Đánh thông minh nếu INT > 20 (Nhắm vào kẻ yếu máu nhất)
        if (attacker.stats.int > 20) {
          target = enemies.sort((a, b) => a.hp - b.hp)[0];
        } else {
          // Đánh theo thứ tự đội hình (Tiền đạo - Slot nhỏ nhất)
          target = enemies.sort((a, b) => a.slot - b.slot)[0];
        }

        // Kiểm tra kĩ năng AoE (INT > 30)
        let isAoE = attacker.stats.int > 30 && Math.random() < 0.1;
        
        let targets = isAoE ? enemies : [target];

        for (let t of targets) {
           // Tính Né tránh
           let dodgeChance = t.stats.agi * 0.3;
           let isDodge = Math.random() * 100 < dodgeChance;
           
           if (isDodge) {
             logs.push({
               round,
               attackerId: attacker._id,
               targetId: t._id,
               type: 'dodge',
               msg: `${t.name} né được đòn của ${attacker.name}!`
             });
           } else {
             let isCrit = Math.random() * 100 < attacker.stats.luk * 0.4;
             let baseDmg = attacker.stats.str * 1.5 + attacker.stats.int * 1.2;
             let dmg = Math.max(1, Math.round(baseDmg));
             if (isCrit) dmg = Math.round(dmg * 1.5);
             if (isAoE) dmg = Math.round(dmg * 0.6); // AoE damage giảm

             t.hp -= dmg;

             let isDead = t.hp <= 0;
             let msg = `${attacker.name} ${isAoE ? 'tung đòn diện rộng' : 'tấn công'} ${isCrit ? 'chí mạng ' : ''}vào ${t.name} (Vị trí ${t.slot}) gây ${dmg} sát thương!`;
             if (isDead) {
               msg += ` ${t.name} đã gục ngã!`;
             }
             
             logs.push({
               round,
               attackerId: attacker._id,
               targetId: t._id,
               type: isCrit ? 'crit' : 'hit',
               isAoE,
               damage: dmg,
               targetHPLeft: Math.max(0, t.hp),
               msg
             });
           }
        }
      }

      // Kiểm tra win/lose
      const teamAAlive = allFighters.filter(f => f.team === 'A' && f.hp > 0).length;
      const teamBAlive = allFighters.filter(f => f.team === 'B' && f.hp > 0).length;
      if (teamAAlive === 0 || teamBAlive === 0) break;
      
      round++;
    }

    const teamAAlive = allFighters.filter(f => f.team === 'A' && f.hp > 0).length;
    const teamBAlive = allFighters.filter(f => f.team === 'B' && f.hp > 0).length;
    
    // Nếu hết 30 round mà chưa xong, tính team nào còn nhiều tổng HP hơn thì win
    let isWin = false;
    if (teamBAlive === 0) {
      isWin = true;
    } else if (teamAAlive === 0) {
      isWin = false;
    } else {
      let aHP = allFighters.filter(f => f.team === 'A').reduce((s, c) => s + c.hp, 0);
      let bHP = allFighters.filter(f => f.team === 'B').reduce((s, c) => s + c.hp, 0);
      isWin = aHP >= bHP;
    }

    let expGain = isWin ? randInt(30, 50) : randInt(5, 10);
    
    let leveledPets = [];
    for (let p of stateA) {
       const leveled = applyExp(p.originalDoc, expGain);
       if (leveled) leveledPets.push(p.name);
       await p.originalDoc.save();
    }
    user.lastCombatDate = new Date();
    
    let reward = 0;
    if (isWin) {
      reward = randInt(30, 80); // Giảm lượng tim thưởng xuống 30-80 để cân bằng
      user.heart += reward;
      await user.save();
      
      if (partner) {
        partner.heart = Math.max(0, partner.heart - reward);
        await partner.save();
      }
    }

    if (user.partnerId) {
      await CombatHistory.create({
        attackerId: user._id,
        defenderId: user.partnerId,
        isAttackerWin: isWin,
        reward: reward
      });
    }

    res.status(200).json({
      success: true,
      logs,
      lastCombatDate: user.lastCombatDate,
      result: {
        isWin,
        expGain,
        leveledPets,
        reward
      },
      teamA: stateA.map(p => ({ _id: p._id, id: p._id, name: p.name, maxHp: p.maxHp, hp: p.maxHp, emoji: p.emoji, stats: p.stats, level: p.originalDoc.level || 1, speciesId: p.originalDoc.speciesId, slot: p.slot, team: p.team })),
      teamB: stateB.map(p => ({ _id: p._id, id: p._id, name: p.name, maxHp: p.maxHp, hp: p.maxHp, emoji: p.emoji, stats: p.stats, level: p.originalDoc.level || 1, speciesId: p.originalDoc.speciesId, slot: p.slot, team: p.team }))
    });

  } catch (error) {
    console.error('combatPets error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const getCombatHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.partnerId) {
      return res.status(400).json({ success: false, message: 'Chưa có người yêu để xem lịch sử.' });
    }

    const history = await CombatHistory.find({
      $or: [
        { attackerId: user._id, defenderId: user.partnerId },
        { attackerId: user.partnerId, defenderId: user._id }
      ]
    }).sort({ createdAt: -1 }).limit(20);

    res.status(200).json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Mới: Mua vật phẩm (Khiên)
const buyItem = async (req, res) => {
  try {
    const { itemId } = req.body;
    const itemDef = ITEMS.find(i => i.id === itemId);
    
    if (!itemDef) return res.status(400).json({ success: false, message: 'Vật phẩm không hợp lệ' });

    const user = await User.findById(req.user.id);
    if (user.heart < itemDef.price) {
      return res.status(400).json({ success: false, message: 'Không đủ heart' });
    }

    user.heart -= itemDef.price;

    if (itemDef.type === 'shield') {
      const now = Date.now();
      if (user.shieldUntil && user.shieldUntil.getTime() > now) {
        return res.status(400).json({ success: false, message: 'Bạn đang có Khiên bảo vệ, không thể mua thêm!' });
      }
      const additionalMs = itemDef.durationDays * 24 * 60 * 60 * 1000;
      user.shieldUntil = new Date(now + additionalMs);
    }

    await user.save();
    res.status(200).json({ success: true, message: `Mua ${itemDef.name} thành công!`, heart: user.heart, shieldUntil: user.shieldUntil });
  } catch (error) {
    console.error('buyItem error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = {
  getPets,
  buyPet,
  renamePet,
  carePet,
  startExpedition,
  collectExpedition,
  buyFood,
  buyItem,
  sellPet,
  devAction,
  getPartnerPets,
  combatPets,
  setDefenseTeam,
  getCombatHistory
};
