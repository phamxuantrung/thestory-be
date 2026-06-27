const getVNDate = (date) => {
  if (!date) return null;
  return new Date(new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
};

const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  const vn1 = getVNDate(d1);
  const vn2 = getVNDate(d2);
  return vn1.toDateString() === vn2.toDateString();
};

const getMaxLevel = (treeType) => {
  return treeType === 'heart' ? 3 : 5;
};

const getExpRequired = (level, treeType = 'basic') => {
  if (treeType === 'heart') {
    switch (level) {
      case 1: return 300;
      case 2: return 700;
      default: return 1200; // Cap for heart tree at level 3
    }
  }

  // Basic tree logic
  switch (level) {
    case 1: return 300;   // Khoảng 1 tuần (Trung bình 40-50 EXP/ngày)
    case 2: return 700;   // Khoảng 2-3 tuần
    case 3: return 1200;  // Khoảng 1 tháng
    case 4: return 2500;  // Cấp cuối cần vượt trội, tốn khoảng gần 2 tháng để max
    default: return 5000; // Cap cho max level
  }
};

module.exports = {
  getVNDate,
  isSameDay,
  getMaxLevel,
  getExpRequired
};
