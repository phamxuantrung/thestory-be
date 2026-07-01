const RARITY = {
  common:    { label: "Thường",     color: "#93a5b8", glow: "#93a5b855", mult: 1.0 },
  rare:      { label: "Hiếm",       color: "#7fd8a6", glow: "#7fd8a666", mult: 1.25 },
  epic:      { label: "Sử Thi",     color: "#8f6fff", glow: "#8f6fff77", mult: 1.6 },
  legendary: { label: "Huyền Thoại",color: "#f2b155", glow: "#f2b15588", mult: 2.1 },
};

const SPECIES = [
  { id: "fox",     name: "Cáo Lửa",        emoji: "🦊", price: 50,   tier: 1, maxCare: { f: 100, h: 120, c: 100 }, baseStats: { str: 10, agi: 15, int: 8,  luk: 12 }, decay: { f: 5, h: 4, c: 3 }, dropRate: 0.6, findableFoods: ["fish", "apple"], fragility: 1.0 },
  { id: "owl",     name: "Cú Đêm",         emoji: "🦉", price: 80,   tier: 1, maxCare: { f: 80,  h: 100, c: 120 }, baseStats: { str: 8,  agi: 12, int: 20, luk: 10 }, decay: { f: 3, h: 5, c: 3 }, dropRate: 0.8, findableFoods: ["carrot", "meat"], fragility: 1.2 },
  { id: "cat",     name: "Mèo Phù Thủy",   emoji: "🐱", price: 120,  tier: 1, maxCare: { f: 90,  h: 150, c: 100 }, baseStats: { str: 10, agi: 18, int: 15, luk: 15 }, decay: { f: 4, h: 5, c: 6 }, dropRate: 0.5, findableFoods: ["fish", "cake"], fragility: 1.0 },
  { id: "wolf",    name: "Sói Trăng",      emoji: "🐺", price: 300,  tier: 2, maxCare: { f: 150, h: 100, c: 100 }, baseStats: { str: 20, agi: 15, int: 10, luk: 8 }, decay: { f: 6, h: 3, c: 4 }, dropRate: 0.7, findableFoods: ["meat", "fish"], fragility: 0.8 },
  { id: "turtle",  name: "Rùa Ngọc",       emoji: "🐢", price: 450,  tier: 2, maxCare: { f: 120, h: 100, c: 150 }, baseStats: { str: 15, agi: 5,  int: 20, luk: 20 }, decay: { f: 2, h: 2, c: 2 }, dropRate: 0.3, findableFoods: ["apple", "carrot"], fragility: 0.5 },
  { id: "panda",   name: "Gấu Trúc Tre",   emoji: "🐼", price: 600,  tier: 2, maxCare: { f: 200, h: 150, c: 80  }, baseStats: { str: 18, agi: 8,  int: 12, luk: 25 }, decay: { f: 8, h: 2, c: 4 }, dropRate: 0.5, findableFoods: ["bamboo", "apple"], fragility: 0.8 },
  { id: "dragon",  name: "Rồng Con",       emoji: "🐉", price: 1500, tier: 3, maxCare: { f: 250, h: 100, c: 200 }, baseStats: { str: 30, agi: 20, int: 25, luk: 15 }, decay: { f: 10, h: 3, c: 5 }, dropRate: 0.9, findableFoods: ["chili", "meat"], fragility: 0.2 },
  { id: "unicorn", name: "Kỳ Lân",         emoji: "🦄", price: 2200, tier: 3, maxCare: { f: 150, h: 200, c: 250 }, baseStats: { str: 15, agi: 25, int: 30, luk: 30 }, decay: { f: 5, h: 6, c: 2 }, dropRate: 0.6, findableFoods: ["candy", "cake"], fragility: 0.2 },
  { id: "phoenix", name: "Phượng Hoàng",   emoji: "🔥", price: 3500, tier: 3, maxCare: { f: 120, h: 180, c: 250 }, baseStats: { str: 25, agi: 30, int: 20, luk: 25 }, decay: { f: 6, h: 8, c: 2 }, dropRate: 0.8, findableFoods: ["chili", "potion"], fragility: 0.2 },
];

const FOODS = [
  { id: "carrot", name: "Cà Rốt Ngọt", emoji: "🥕", price: 1, fullness: 15, happiness: 5 },
  { id: "bamboo", name: "Măng Non", emoji: "🎍", price: 2, fullness: 30, happiness: 5 },
  { id: "apple", name: "Táo Ngọt", emoji: "🍎", price: 2, fullness: 20, happiness: 10 },
  { id: "fish", name: "Cá Hồi Tươi", emoji: "🐟", price: 3, fullness: 45, happiness: 15 },
  { id: "meat", name: "Thịt Nướng", emoji: "🍖", price: 4, fullness: 50, happiness: 15 },
  { id: "candy", name: "Kẹo Bảy Màu", emoji: "🍬", price: 5, fullness: 10, happiness: 50 },
  { id: "cookie", name: "Bánh Quy Bơ", emoji: "🍪", price: 4, fullness: 15, happiness: 25 },
  { id: "cotton_candy", name: "Kẹo Bông Gòn", emoji: "🍡", price: 5, fullness: 5, happiness: 40 },
  { id: "cake", name: "Bánh Kem", emoji: "🍰", price: 6, fullness: 40, happiness: 30 },
  { id: "chili", name: "Ớt Hỏa Ngục", emoji: "🌶️", price: 8, fullness: 60, happiness: 20 },
  { id: "potion", name: "Lọ Thể Lực", emoji: "🧪", price: 15, fullness: 999, happiness: 999 }, // 999 to max out
];

const DESTINATIONS = [
  {
    id: "moss", name: "Rừng Rêu Xanh", emoji: "🌿", color: "#7fd8a6",
    durationHours: 2, rewardMin: 10, rewardMax: 20, statRec: 10, baseDanger: 0.05,
    desc: "Khu rừng cổ tích ngập nắng. Lý tưởng để các bé cưng bắt đầu hành trình.",
  },
  {
    id: "cave", name: "Hang Động Pha Lê", emoji: "🔮", color: "#8f6fff",
    durationHours: 4, rewardMin: 25, rewardMax: 45, statRec: 30, baseDanger: 0.15,
    desc: "Hang động lấp lánh đá quý. Cần chút bản lĩnh trong bóng tối.",
  },
  {
    id: "peak", name: "Đỉnh Núi Mây Tía", emoji: "⛰️", color: "#f2b155",
    durationHours: 8, rewardMin: 60, rewardMax: 100, statRec: 60, baseDanger: 0.30,
    desc: "Đỉnh núi huyền thoại. Chỉ dành cho thú cưng dày dạn kinh nghiệm.",
  },
];

const MAX_PETS = 5;

const ITEMS = [
  { id: "shield_1", name: "Khiên Đồng (x1)", emoji: "🛡️", price: 100, type: "shield", durationDays: 1, desc: "Bảo vệ Vườn khỏi bị tấn công trong 1 ngày" },
  { id: "shield_3", name: "Khiên Vàng (x3)", emoji: "🔰", price: 250, type: "shield", durationDays: 3, desc: "Bảo vệ Vườn khỏi bị tấn công trong 3 ngày" }
];

module.exports = { RARITY, SPECIES, FOODS, DESTINATIONS, MAX_PETS, ITEMS };
