const User = require('../models/User');
const WeeklyCheckin = require('../models/WeeklyCheckin');
const WeeklyHeartTasks = require('../models/WeeklyHeartTasks');

// ── Helpers ──────────────────────────────────────────────────────────────────

const getISOWeek = (date) => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
};

const getWeekIdentifier = () => {
  const now = new Date();
  const vnStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(vnStr);
  return `${vnDate.getFullYear()}-W${getISOWeek(vnDate)}`;
};

// Lấy ngày trong tuần theo múi giờ VN (0=Thứ2 ... 6=Chủ nhật)
const getVNDayOfWeek = () => {
  const now = new Date();
  const vnStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(vnStr);
  // getDay(): 0=Sun,1=Mon,...6=Sat => chuyển về 0=Mon...6=Sun
  return (vnDate.getDay() + 6) % 7;
};

// Phần thưởng điểm danh mỗi ngày (0=Thứ2 ... 6=Chủ nhật)
const CHECKIN_REWARDS = [5, 5, 8, 8, 10, 10, 20];

// ── Pool nhiệm vụ Heart ───────────────────────────────────────────────────────
const TASK_POOL = [
  { taskId: 'chat_5msg',     title: 'Nhắn tin ngọt ngào',    description: 'Gửi 5 tin nhắn cho người ấy trong ngày',      category: 'chat',     icon: 'chat',            heartReward: 8  },
  { taskId: 'chat_sticker',  title: 'Gửi sticker yêu thương', description: 'Gửi ít nhất 3 sticker trong cuộc trò chuyện', category: 'chat',     icon: 'emoji_emotions',  heartReward: 5  },
  { taskId: 'memory_add',    title: 'Lưu giữ kỷ niệm',       description: 'Thêm 1 kỷ niệm mới vào album tình yêu',       category: 'memory',   icon: 'photo_album',     heartReward: 12 },
  { taskId: 'mood_log',      title: 'Ghi nhận cảm xúc',      description: 'Cập nhật tâm trạng hôm nay của bạn',          category: 'mood',     icon: 'mood',            heartReward: 6  },
  { taskId: 'letter_write',  title: 'Viết thư tương lai',     description: 'Viết 1 bức thư tương lai gửi người ấy',       category: 'letter',   icon: 'mail',            heartReward: 15 },
  { taskId: 'location_save', title: 'Đánh dấu địa điểm',     description: 'Lưu 1 địa điểm yêu thích lên bản đồ',         category: 'location', icon: 'location_on',     heartReward: 10 },
  { taskId: 'store_buy',     title: 'Ghé tạp hoá',            description: 'Đặt 1 đơn hàng từ tạp hoá của người ấy',      category: 'store',    icon: 'storefront',      heartReward: 18 },
  { taskId: 'game_play',     title: 'Cùng nhau vui chơi',     description: 'Chơi ít nhất 1 trò chơi trong app',           category: 'game',     icon: 'sports_esports',  heartReward: 10 },
  { taskId: 'tree_water',    title: 'Tưới cây tình yêu',      description: 'Vào trang cây tình yêu và tưới nước',         category: 'tree',     icon: 'psychiatry',      heartReward: 8  },
  { taskId: 'quest_accept',  title: 'Nhận thử thách đôi',     description: 'Nhận 1 thử thách trong trang Thử Thách',      category: 'quest',    icon: 'task_alt',        heartReward: 12 },
  { taskId: 'diary_write',   title: 'Viết nhật ký chung',     description: 'Thêm 1 trang vào nhật ký tình yêu',          category: 'diary',    icon: 'book',            heartReward: 10 },
  { taskId: 'chat_good_morning', title: 'Chào buổi sáng',    description: 'Gửi tin nhắn đầu ngày cho người ấy',          category: 'chat',     icon: 'wb_sunny',        heartReward: 5  },
  { taskId: 'photo_memory',  title: 'Ảnh kỷ niệm',           description: 'Đăng 1 kỷ niệm có ảnh mới',                  category: 'memory',   icon: 'add_a_photo',     heartReward: 15 },
  { taskId: 'mood_3days',    title: 'Kiên trì ghi mood',      description: 'Ghi nhận tâm trạng 3 ngày trong tuần này',   category: 'mood',     icon: 'calendar_month',  heartReward: 20 },
  { taskId: 'future_letter2',title: 'Thư bí mật',             description: 'Viết thư tương lai hẹn mở sau 1 tháng',      category: 'letter',   icon: 'lock',            heartReward: 18 },
  { taskId: 'game_win',      title: 'Chiến thắng mini game',  description: 'Đạt điểm cao trong bất kỳ trò chơi nào',     category: 'game',     icon: 'emoji_events',    heartReward: 12 },
  { taskId: 'store_browse',  title: 'Khám phá tạp hoá',       description: 'Ghé thăm tạp hoá của người ấy',              category: 'store',    icon: 'shopping_bag',    heartReward: 6  },
  { taskId: 'map_visit',     title: 'Bản đồ yêu thương',      description: 'Mở bản đồ và xem lại các địa điểm đặc biệt', category: 'location', icon: 'map',             heartReward: 8  },
  { taskId: 'chat_reaction', title: 'Phản ứng cảm xúc',       description: 'Dùng reaction emoji trong chat ít nhất 1 lần',category: 'chat',     icon: 'favorite',        heartReward: 5  },
  { taskId: 'checkin_3days', title: 'Điểm danh chuyên cần',   description: 'Điểm danh ít nhất 3 ngày trong tuần này',    category: 'checkin',  icon: 'event_available', heartReward: 25 },
];

// Chọn ngẫu nhiên n nhiệm vụ từ pool, ưu tiên không trùng với tuần trước
const pickRandomTasks = (count, excludeIds = []) => {
  const available = TASK_POOL.filter(t => !excludeIds.includes(t.taskId));
  const pool = available.length >= count ? available : TASK_POOL;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

// ── Điểm danh ────────────────────────────────────────────────────────────────

exports.getCheckin = async (req, res) => {
  try {
    const userId = req.user.id;
    const weekIdentifier = getWeekIdentifier();

    let checkin = await WeeklyCheckin.findOne({ userId, weekIdentifier });

    if (!checkin) {
      // Tạo bảng điểm danh mới cho tuần này
      const days = CHECKIN_REWARDS.map((reward, idx) => ({
        dayOfWeek: idx,
        heartReward: reward,
        checkedIn: false,
        checkedAt: null,
      }));
      checkin = await WeeklyCheckin.create({ userId, weekIdentifier, days });
    }

    res.json({ success: true, data: checkin });
  } catch (error) {
    console.error('getCheckin error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.doCheckin = async (req, res) => {
  try {
    const userId = req.user.id;
    const weekIdentifier = getWeekIdentifier();
    const todayDayOfWeek = getVNDayOfWeek();

    let checkin = await WeeklyCheckin.findOne({ userId, weekIdentifier });
    if (!checkin) {
      const days = CHECKIN_REWARDS.map((reward, idx) => ({
        dayOfWeek: idx, heartReward: reward, checkedIn: false, checkedAt: null,
      }));
      checkin = await WeeklyCheckin.create({ userId, weekIdentifier, days });
    }

    const todayDay = checkin.days[todayDayOfWeek];
    if (todayDay.checkedIn) {
      return res.status(400).json({ success: false, message: 'Bạn đã điểm danh hôm nay rồi!' });
    }

    // Ghi điểm danh
    checkin.days[todayDayOfWeek].checkedIn = true;
    checkin.days[todayDayOfWeek].checkedAt = new Date();
    checkin.markModified('days');
    await checkin.save();

    // Cộng Heart
    const heartEarned = todayDay.heartReward;
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { heart: heartEarned } },
      { new: true }
    );

    res.json({ success: true, data: checkin, heartEarned, newTotal: user.heart });
  } catch (error) {
    console.error('doCheckin error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── Nhiệm vụ Heart ────────────────────────────────────────────────────────────

exports.getTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const weekIdentifier = getWeekIdentifier();

    let record = await WeeklyHeartTasks.findOne({ userId, weekIdentifier });

    if (!record) {
      // Lấy taskId tuần trước để hạn chế trùng
      const prevRecords = await WeeklyHeartTasks.find({ userId })
        .sort({ createdAt: -1 }).limit(2);
      const prevTaskIds = prevRecords.flatMap(r => r.tasks.map(t => t.taskId));

      // Chọn ngẫu nhiên 3–7 nhiệm vụ
      const count = Math.floor(Math.random() * 5) + 3; // 3–7
      const picked = pickRandomTasks(count, prevTaskIds);

      record = await WeeklyHeartTasks.create({
        userId,
        weekIdentifier,
        tasks: picked,
      });
    }

    res.json({ success: true, data: record });
  } catch (error) {
    console.error('getTasks error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── Imports cho verify ───────────────────────────────────────────────────────
const Message         = require('../models/Message');
const Memory          = require('../models/Memory');
const DailyMood       = require('../models/DailyMood');
const FutureLetter    = require('../models/FutureLetter');
const LoveLocation    = require('../models/LoveLocation');
const StoreOrder      = require('../models/StoreOrder');
const Quest           = require('../models/Quest');
const LoveTree        = require('../models/LoveTree');

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds

// Trả về UTC timestamp tương ứng với 00:00 hôm nay theo giờ VN
const getTodayStart = () => {
  const nowUtcMs = Date.now() + VN_OFFSET_MS;          // shift sang VN timezone
  const vnMidnightMs = Math.floor(nowUtcMs / 86400000) * 86400000; // floor về 00:00 VN
  return new Date(vnMidnightMs - VN_OFFSET_MS);        // shift lại về UTC
};

// Trả về UTC timestamp tương ứng với 00:00 thứ Hai đầu tuần theo giờ VN
const getWeekStart = () => {
  const nowUtcMs = Date.now() + VN_OFFSET_MS;          // shift sang VN timezone
  const vnDate = new Date(nowUtcMs);                    // VN date (treat as if UTC)
  const dayOfWeek = (vnDate.getUTCDay() + 6) % 7;     // 0=T2 ... 6=CN
  const vnWeekStartMs =
    Math.floor(nowUtcMs / 86400000) * 86400000         // VN 00:00 hôm nay
    - dayOfWeek * 86400000;                             // lùi về T2
  return new Date(vnWeekStartMs - VN_OFFSET_MS);        // shift lại về UTC
};

/**
 * Hàm verify từng task — trả về { ok, reason }
 * ok = true → cho phép claim
 * ok = false → chặn với lý do
 */
const VERIFIERS = {

  // ── Chat ────────────────────────────────────────────────────────────────────
  chat_5msg: async (userId, user) => {
    const weekStart = getWeekStart();
    const count = await Message.countDocuments({ sender: userId, createdAt: { $gte: weekStart } });
    if (count < 5) return { ok: false, reason: `Bạn mới gửi ${count}/5 tin nhắn tuần này. Hãy nhắn thêm nhé!` };
    return { ok: true };
  },

  chat_sticker: async (userId) => {
    const weekStart = getWeekStart();
    const count = await Message.countDocuments({ sender: userId, type: 'sticker', createdAt: { $gte: weekStart } });
    if (count < 3) return { ok: false, reason: `Bạn mới gửi ${count}/3 sticker tuần này.` };
    return { ok: true };
  },

  chat_good_morning: async (userId) => {
    const todayStart = getTodayStart();
    const count = await Message.countDocuments({ sender: userId, createdAt: { $gte: todayStart } });
    if (count < 1) return { ok: false, reason: 'Hãy gửi ít nhất 1 tin nhắn cho người ấy hôm nay đã nhé!' };
    return { ok: true };
  },

  chat_reaction: async (userId) => {
    const weekStart = getWeekStart();
    // Tìm tin nhắn có reaction của user
    const msg = await Message.findOne({ 'reactions.userId': userId, createdAt: { $gte: weekStart } });
    if (!msg) return { ok: false, reason: 'Hãy thả reaction cho tin nhắn của người ấy trong tuần này!' };
    return { ok: true };
  },

  // ── Memory ──────────────────────────────────────────────────────────────────
  memory_add: async (userId) => {
    const weekStart = getWeekStart();
    const count = await Memory.countDocuments({ createdBy: userId, createdAt: { $gte: weekStart } });
    if (count < 1) return { ok: false, reason: 'Hãy thêm ít nhất 1 kỷ niệm trong tuần này!' };
    return { ok: true };
  },

  photo_memory: async (userId) => {
    const weekStart = getWeekStart();
    const mem = await Memory.findOne({ createdBy: userId, 'images.0': { $exists: true }, createdAt: { $gte: weekStart } });
    if (!mem) return { ok: false, reason: 'Hãy thêm 1 kỷ niệm có ảnh trong tuần này!' };
    return { ok: true };
  },

  // ── Mood ────────────────────────────────────────────────────────────────────
  mood_log: async (userId) => {
    const todayStart = getTodayStart();
    const mood = await DailyMood.findOne({ user: userId, date: { $gte: todayStart } });
    if (!mood) return { ok: false, reason: 'Hãy ghi nhận tâm trạng hôm nay trước!' };
    return { ok: true };
  },

  mood_3days: async (userId) => {
    const weekStart = getWeekStart();
    const count = await DailyMood.countDocuments({ user: userId, date: { $gte: weekStart } });
    if (count < 3) return { ok: false, reason: `Bạn mới ghi mood ${count}/3 ngày tuần này.` };
    return { ok: true };
  },

  // ── Letter ──────────────────────────────────────────────────────────────────
  letter_write: async (userId) => {
    const weekStart = getWeekStart();
    const letter = await FutureLetter.findOne({ sender: userId, createdAt: { $gte: weekStart } });
    if (!letter) return { ok: false, reason: 'Hãy viết 1 bức thư tương lai trong tuần này!' };
    return { ok: true };
  },

  future_letter2: async (userId) => {
    const weekStart = getWeekStart();
    // Thư có unlockDate ≥ 1 tháng kể từ bây giờ
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    const letter = await FutureLetter.findOne({ sender: userId, unlockDate: { $gte: oneMonthLater }, createdAt: { $gte: weekStart } });
    if (!letter) return { ok: false, reason: 'Hãy viết thư tương lai với thời hạn mở ít nhất 1 tháng!' };
    return { ok: true };
  },

  // ── Location ────────────────────────────────────────────────────────────────
  location_save: async (userId) => {
    const weekStart = getWeekStart();
    const loc = await LoveLocation.findOne({ user: userId, createdAt: { $gte: weekStart } });
    if (!loc) return { ok: false, reason: 'Hãy lưu 1 địa điểm mới lên bản đồ trong tuần này!' };
    return { ok: true };
  },

  map_visit: async (userId) => {
    // Kiểm tra user có ít nhất 1 địa điểm → chứng tỏ đã dùng bản đồ
    const loc = await LoveLocation.findOne({ user: userId });
    if (!loc) return { ok: false, reason: 'Hãy lưu ít nhất 1 địa điểm lên bản đồ tình yêu!' };
    return { ok: true };
  },

  // ── Store ───────────────────────────────────────────────────────────────────
  store_buy: async (userId) => {
    const weekStart = getWeekStart();
    const order = await StoreOrder.findOne({ buyer: userId, createdAt: { $gte: weekStart } });
    if (!order) return { ok: false, reason: 'Hãy đặt ít nhất 1 đơn hàng từ tạp hoá trong tuần này!' };
    return { ok: true };
  },

  store_browse: async (userId) => {
    // Honor system — reward thấp (6), không có event log browse
    return { ok: true };
  },

  // ── Quest ───────────────────────────────────────────────────────────────────
  quest_accept: async (userId, user) => {
    if (!user.partnerId) return { ok: false, reason: 'Bạn cần kết nối với người ấy trước.' };
    const tree = await LoveTree.findOne({ users: { $all: [userId, user.partnerId] } });
    if (!tree) return { ok: false, reason: 'Không tìm thấy Cây tình yêu.' };
    const weekStart = getWeekStart();
    const weekIdentifier = getWeekIdentifier();
    const quest = await Quest.findOne({ coupleId: tree._id, weekIdentifier, acceptedBy: userId });
    if (!quest) return { ok: false, reason: 'Hãy nhận ít nhất 1 thử thách đôi trong tuần này!' };
    return { ok: true };
  },

  // ── Điểm danh streak ────────────────────────────────────────────────────────
  checkin_3days: async (userId) => {
    const weekIdentifier = getWeekIdentifier();
    const checkinRecord = await WeeklyCheckin.findOne({ userId, weekIdentifier });
    if (!checkinRecord) return { ok: false, reason: 'Hãy điểm danh ít nhất 3 ngày trong tuần này!' };
    const checkedCount = checkinRecord.days.filter(d => d.checkedIn).length;
    if (checkedCount < 3) return { ok: false, reason: `Bạn mới điểm danh ${checkedCount}/3 ngày tuần này.` };
    return { ok: true };
  },

  // ── Tree ────────────────────────────────────────────────────────────────────
  tree_water: async (userId, user) => {
    if (!user.partnerId) return { ok: false, reason: 'Bạn cần kết nối với người ấy trước.' };
    const tree = await LoveTree.findOne({ users: { $all: [userId, user.partnerId] } });
    if (!tree) return { ok: false, reason: 'Chưa có Cây tình yêu.' };
    // Kiểm tra userInteractions hoặc lastWateredBy trong tuần này
    const weekStart = getWeekStart();
    const interaction = tree.userInteractions?.find(i => String(i.user) === String(userId));
    const wateredAt = interaction?.lastWateredAt || tree.lastWateredAt;
    if (!wateredAt || new Date(wateredAt) < weekStart) {
      return { ok: false, reason: 'Hãy tưới cây tình yêu ít nhất 1 lần trong tuần này!' };
    }
    return { ok: true };
  },

  // ── Store browse ────────────────────────────────────────────────────────────
  store_browse: async (userId) => {
    // Kiểm tra đã từng đặt hàng bất kỳ lúc nào (có dùng tạp hoá)
    const order = await StoreOrder.findOne({ buyer: userId });
    if (!order) return { ok: false, reason: 'Hãy ghé tạp hoá và đặt ít nhất 1 đơn hàng để hoàn thành nhiệm vụ này!' };
    return { ok: true };
  },

  // ── Game ─────────────────────────────────────────────────────────────────────
  // Game sinh EXP cho cây, kiểm tra tree.exp > 0 hoặc tree đã đủ tuần active
  game_play: async (userId, user) => {
    if (!user.partnerId) return { ok: true }; // Chưa kết nối → honor
    const tree = await LoveTree.findOne({ users: { $all: [userId, user.partnerId] } });
    if (!tree) return { ok: true };
    // Nếu cây có exp > 0 nghĩa là đã từng chơi game hoặc tương tác
    if ((tree.exp || 0) < 1) return { ok: false, reason: 'Hãy chơi ít nhất 1 trò chơi trong app để kiếm EXP cho cây!' };
    return { ok: true };
  },

  game_win: async (userId, user) => {
    if (!user.partnerId) return { ok: true };
    const tree = await LoveTree.findOne({ users: { $all: [userId, user.partnerId] } });
    if (!tree) return { ok: true };
    if ((tree.exp || 0) < 10) return { ok: false, reason: 'Hãy chơi và đạt điểm trong ít nhất 1 trò chơi!' };
    return { ok: true };
  },

  // ── Diary — dùng DailyMood (SharedDiaryPage = ghi mood) ───────────────────
  diary_write: async (userId) => {
    const weekStart = getWeekStart();
    const count = await DailyMood.countDocuments({ user: userId, date: { $gte: weekStart } });
    if (count < 1) return { ok: false, reason: 'Hãy mở Nhật ký chung và ghi tâm trạng ít nhất 1 ngày trong tuần này!' };
    return { ok: true };
  },
};

exports.verifyTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const weekIdentifier = getWeekIdentifier();

    const record = await WeeklyHeartTasks.findOne({ userId, weekIdentifier });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhiệm vụ tuần này.' });
    }

    const task = record.tasks.find(t => t.taskId === taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhiệm vụ.' });
    }
    if (task.completed) {
      return res.json({ success: true, verified: true, alreadyDone: true });
    }

    const verifier = VERIFIERS[taskId];
    if (!verifier) {
      return res.json({ success: true, verified: true });
    }

    const user = await User.findById(userId);
    const { ok, reason } = await verifier(userId, user);

    res.json({ success: true, verified: ok, reason: ok ? null : reason });
  } catch (error) {
    console.error('verifyTask error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.completeTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;
    const weekIdentifier = getWeekIdentifier();

    const record = await WeeklyHeartTasks.findOne({ userId, weekIdentifier });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhiệm vụ tuần này.' });
    }

    const task = record.tasks.find(t => t.taskId === taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhiệm vụ.' });
    }
    if (task.completed) {
      return res.status(400).json({ success: false, message: 'Nhiệm vụ này đã hoàn thành rồi!' });
    }

    // ── Xác thực activity ──────────────────────────────────────────────────
    const verifier = VERIFIERS[taskId];
    if (verifier) {
      const user = await User.findById(userId);
      const { ok, reason } = await verifier(userId, user);
      if (!ok) {
        return res.status(400).json({ success: false, message: reason, notVerified: true });
      }
    }
    // Nếu không có verifier → không block (future-proof)

    task.completed = true;
    task.completedAt = new Date();
    record.markModified('tasks');
    await record.save();

    // Cộng Heart
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { heart: task.heartReward } },
      { new: true }
    );

    res.json({ success: true, data: record, heartEarned: task.heartReward, newTotal: updatedUser.heart });
  } catch (error) {
    console.error('completeTask error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
