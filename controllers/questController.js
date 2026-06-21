const Quest = require('../models/Quest');
const LoveTree = require('../models/LoveTree');
const User = require('../models/User');
const { generateCoupleQuests } = require('../services/aiService');

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
  return `${now.getFullYear()}-W${getISOWeek(now)}`;
};

const getActiveQuests = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user.partnerId) {
      return res.status(400).json({ success: false, message: 'Bạn cần kết nối với người ấy trước.' });
    }

    const tree = await LoveTree.findOne({ users: { $all: [userId, user.partnerId] } });
    if (!tree) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Cây tình yêu.' });
    }

    const weekIdentifier = getWeekIdentifier();
    
    // Tìm nhiệm vụ của tuần hiện tại
    let quests = await Quest.find({ coupleId: tree._id, weekIdentifier });

    let refreshCount = 0;
    if (tree.questRefreshData && tree.questRefreshData.week === weekIdentifier) {
      refreshCount = tree.questRefreshData.count || 0;
    }

    res.json({ success: true, data: quests, refreshCount });
  } catch (error) {
    console.error('Lỗi khi tạo nhiệm vụ:', error);
    try {
      require('fs').writeFileSync('error_log.txt', error.stack || error.message);
    } catch(e) {}
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

const getQuestHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user || !user.partnerId) {
      return res.status(400).json({ success: false, message: 'Chưa kết nối partner.' });
    }

    const tree = await LoveTree.findOne({ users: { $all: [userId, user.partnerId] } });
    if (!tree) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Cây tình yêu.' });
    }

    // Lấy tất cả nhiệm vụ đã hoàn thành, sắp xếp mới nhất lên đầu
    const history = await Quest.find({ coupleId: tree._id, status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(50); // Giới hạn 50 cái gần nhất cho nhẹ

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử nhiệm vụ:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

const generateQuests = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('partnerId');
    if (!user || !user.partnerId) {
      return res.status(400).json({ success: false, message: 'Chưa kết nối partner.' });
    }

    const tree = await LoveTree.findOne({ users: { $all: [userId, user.partnerId._id] } });
    if (!tree) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Cây tình yêu.' });
    }

    const weekIdentifier = getWeekIdentifier();
    const { force } = req.body || {};

    let refreshCount = 0;
    if (tree.questRefreshData && tree.questRefreshData.week === weekIdentifier) {
      refreshCount = tree.questRefreshData.count || 0;
    } else {
      tree.questRefreshData = { week: weekIdentifier, count: 0 };
    }

    let existingQuests = await Quest.find({ coupleId: tree._id, weekIdentifier });
    
    if (existingQuests.length > 0) {
      if (force) {
        if (refreshCount >= 3) {
          return res.status(400).json({ success: false, message: 'Đã hết lượt làm mới thử thách tuần này (Tối đa 3 lần/tuần).' });
        }

        // Xóa các nhiệm vụ chưa hoàn thành
        const pendingIds = existingQuests.filter(q => q.status === 'pending').map(q => q._id);
        if (pendingIds.length > 0) {
          await Quest.deleteMany({ _id: { $in: pendingIds } });
        }
        // Lấy lại danh sách nhiệm vụ (chỉ còn những cái đã hoàn thành)
        existingQuests = await Quest.find({ coupleId: tree._id, weekIdentifier });
        
        // Nếu đã đủ 5 nhiệm vụ hoàn thành thì không cho tạo thêm
        if (existingQuests.length >= 5) {
          return res.json({ success: true, data: existingQuests, refreshCount, message: 'Nhiệm vụ tuần này đã tồn tại.' });
        }
      } else {
        return res.json({ success: true, data: existingQuests, refreshCount, message: 'Nhiệm vụ tuần này đã tồn tại.' });
      }
    }

    // Xác định số lượng cần tạo (tối đa 5, trừ đi số quest đã hoàn thành)
    const completedCount = existingQuests ? existingQuests.length : 0;
    const countToGenerate = 5 - completedCount;

    if (countToGenerate <= 0) {
      return res.json({ success: true, data: existingQuests, refreshCount });
    }

    // Lấy sở thích
    const allHobbies = [...(user.partnerHobbies || []), ...(user.partnerId.partnerHobbies || [])];

    // Lấy lịch sử nhiệm vụ (10 nhiệm vụ gần nhất)
    const pastQuests = await Quest.find({ coupleId: tree._id }).sort({ createdAt: -1 }).limit(10);
    const pastTitles = pastQuests.map(q => q.title);

    // Gọi AI tạo nhiệm vụ
    const generatedQuests = await generateCoupleQuests(
      allHobbies, 
      pastTitles, 
      countToGenerate, 
      user.bio, 
      user.partnerId.bio
    );

    if (!generatedQuests || !Array.isArray(generatedQuests)) {
      throw new Error('AI trả về định dạng không đúng');
    }

    // Lưu vào DB
    const questsToInsert = generatedQuests.map((q, index) => ({
      coupleId: tree._id,
      weekIdentifier,
      title: q.title || q.Title || `Thử thách tuần ${index + 1}`,
      description: q.description || q.Description || 'Cùng nhau hoàn thành thử thách này để nhận thưởng nhé!',
      expReward: parseInt(q.expReward) || 100,
      coinReward: parseInt(q.coinReward) || 20,
    }));

    const newQuests = await Quest.insertMany(questsToInsert);
    
    // Ghép quest cũ (nếu có) và quest mới
    const allCurrentQuests = [...(existingQuests || []), ...newQuests];

    if (force) {
      tree.questRefreshData.count += 1;
      await tree.save();
      refreshCount = tree.questRefreshData.count;
    }

    res.json({ success: true, data: allCurrentQuests, refreshCount });
  } catch (error) {
    console.error('Lỗi khi tạo nhiệm vụ bằng AI:', error);
    require('fs').writeFileSync('error_log.txt', error.stack || error.message);
    res.status(500).json({ success: false, message: 'Không thể tạo nhiệm vụ lúc này. Vui lòng thử lại.', error: error.message });
  }
};

const acceptQuest = async (req, res) => {
  try {
    const userId = req.user.id;
    const questId = req.params.id;

    const quest = await Quest.findById(questId);
    if (!quest) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhiệm vụ' });
    }

    if (quest.status === 'expired') {
      return res.status(400).json({ success: false, message: 'Nhiệm vụ này đã hết hạn.' });
    }

    if (!quest.acceptedBy) {
      quest.acceptedBy = [];
    }

    const userIndex = quest.acceptedBy.indexOf(userId);
    let isNowAcceptedByMe = false;

    if (userIndex !== -1) {
      if (quest.completedBy && quest.completedBy.length > 0) {
        return res.status(400).json({ success: false, message: 'Không thể hủy nhận khi đã có tiến độ hoàn thành.' });
      }
      quest.acceptedBy.splice(userIndex, 1);
      isNowAcceptedByMe = false;
    } else {
      quest.acceptedBy.push(userId);
      isNowAcceptedByMe = true;
    }

    await quest.save();

    res.json({ success: true, data: quest, isNowAcceptedByMe });
  } catch (error) {
    console.error('Lỗi khi nhận nhiệm vụ:', error);
    try {
      require('fs').writeFileSync('error_log.txt', error.stack || error.message);
    } catch(e) {}
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

const completeQuest = async (req, res) => {
  try {
    const userId = req.user.id;
    const questId = req.params.id;

    const quest = await Quest.findById(questId);
    if (!quest) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhiệm vụ' });
    }

    if (quest.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Nhiệm vụ này đã hoàn thành hoàn toàn, không thể bỏ xác nhận.' });
    }

    if (quest.status === 'expired') {
      return res.status(400).json({ success: false, message: 'Nhiệm vụ này đã hết hạn.' });
    }

    if (!quest.acceptedBy || quest.acceptedBy.length < 2) {
      return res.status(400).json({ success: false, message: 'Cả hai phải nhận thử thách trước khi xác nhận hoàn thành.' });
    }

    // Kiểm tra xem user đã xác nhận chưa
    const userIndex = quest.completedBy.indexOf(userId);
    let isNowCompletedByMe = false;

    if (userIndex !== -1) {
      // Đã xác nhận -> Bỏ xác nhận
      quest.completedBy.splice(userIndex, 1);
      isNowCompletedByMe = false;
    } else {
      // Chưa xác nhận -> Xác nhận
      quest.completedBy.push(userId);
      isNowCompletedByMe = true;
    }

    let bothCompleted = false;
    if (quest.completedBy.length >= 2) {
      quest.status = 'completed';
      quest.completedAt = new Date();
      bothCompleted = true;

      // Cộng phần thưởng
      await LoveTree.findByIdAndUpdate(quest.coupleId, {
        $inc: { exp: quest.expReward, coins: quest.coinReward }
      });
    }

    await quest.save();

    res.json({ success: true, data: quest, bothCompleted, isNowCompletedByMe });
  } catch (error) {
    console.error('Lỗi khi hoàn thành nhiệm vụ:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

module.exports = {
  getActiveQuests,
  getQuestHistory,
  generateQuests,
  acceptQuest,
  completeQuest
};
