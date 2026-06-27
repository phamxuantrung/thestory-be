const TelepathyQuiz = require('../models/TelepathyQuiz');
const LoveTree = require('../models/LoveTree');
const User = require('../models/User');
const { generateTelepathyQuestion } = require('../services/aiService');

const getVnDate = () => {
  const now = new Date();
  const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const vnDate = new Date(vnTimeStr);
  const year = vnDate.getFullYear();
  const month = String(vnDate.getMonth() + 1).padStart(2, '0');
  const day = String(vnDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayQuiz = async (req, res) => {
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

    const todayDate = getVnDate();
    
    // Tìm quiz hôm nay
    let quiz = await TelepathyQuiz.findOne({ coupleId: tree._id, date: todayDate });
    
    // Nếu chưa có, sinh mới
    if (!quiz) {
      // Lấy lịch sử vài ngày gần nhất để tránh lặp
      const pastQuizzes = await TelepathyQuiz.find({ coupleId: tree._id })
        .sort({ createdAt: -1 })
        .limit(10);
      const pastQuestions = pastQuizzes.map(q => `${q.optionA} - ${q.optionB}`);
      
      const generated = await generateTelepathyQuestion(pastQuestions);
      
      quiz = new TelepathyQuiz({
        coupleId: tree._id,
        date: todayDate,
        optionA: generated.optionA || 'Trà sữa',
        optionB: generated.optionB || 'Cà phê',
        answers: {}
      });
      await quiz.save();
    }

    // Convert Map to plain object for response
    const quizData = quiz.toObject();
    const plainAnswers = {};
    if (quiz.answers) {
      if (typeof quiz.answers.entries === 'function') {
        for (let [k, v] of quiz.answers.entries()) {
          plainAnswers[k] = v;
        }
      } else {
        Object.assign(plainAnswers, quiz.answers);
      }
    }
    quizData.answers = plainAnswers;
    
    res.json({ success: true, data: quizData });
  } catch (error) {
    console.error('Lỗi khi lấy Telepathy Quiz:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

const answerQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { choice } = req.body; // 'A' or 'B'
    
    if (!['A', 'B'].includes(choice)) {
      return res.status(400).json({ success: false, message: 'Lựa chọn không hợp lệ' });
    }

    const user = await User.findById(userId);
    const partnerId = user.partnerId;

    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'Chưa kết nối' });
    }

    const todayDate = getVnDate();
    const tree = await LoveTree.findOne({ users: { $all: [userId, partnerId] } });
    if (!tree) return res.status(404).json({ success: false, message: 'Không tìm thấy Cây tình yêu' });

    let quiz = await TelepathyQuiz.findOne({ coupleId: tree._id, date: todayDate });
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Chưa có quiz hôm nay' });
    }

    // Ghi nhận câu trả lời
    if (quiz.answers && typeof quiz.answers.set === 'function') {
      quiz.answers.set(userId.toString(), choice);
    } else {
      if (!quiz.answers) quiz.answers = {};
      quiz.answers[userId.toString()] = choice;
    }
    quiz.markModified('answers');
    
    let resultData = {
      isMatched: false,
      bothAnswered: false,
      rewarded: false
    };

    // Kiểm tra xem đối phương đã trả lời chưa
    const partnerChoice = (quiz.answers && typeof quiz.answers.get === 'function') 
      ? quiz.answers.get(partnerId.toString())
      : (quiz.answers ? quiz.answers[partnerId.toString()] : null);
    
    if (partnerChoice) {
      resultData.bothAnswered = true;
      if (partnerChoice === choice) {
        resultData.isMatched = true;
        
        // Cộng 20 Heart cho cả 2 nếu chưa thưởng
        if (!quiz.rewarded) {
          quiz.rewarded = true;
          quiz.isMatched = true;
          await User.findByIdAndUpdate(userId, { $inc: { heart: 20 } });
          await User.findByIdAndUpdate(partnerId, { $inc: { heart: 20 } });
          resultData.rewarded = true;
        }
      }
    }

    await quiz.save();
    
    const quizData = quiz.toObject();
    
    // Đảm bảo answers là plain object khi chuyển qua JSON
    const plainAnswers = {};
    if (quiz.answers) {
      if (typeof quiz.answers.entries === 'function') {
        for (let [k, v] of quiz.answers.entries()) {
          plainAnswers[k] = v;
        }
      } else {
        Object.assign(plainAnswers, quiz.answers);
      }
    }
    quizData.answers = plainAnswers;

    res.json({ success: true, data: quizData, result: resultData });
  } catch (error) {
    console.error('Lỗi khi trả lời Telepathy Quiz:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = {
  getTodayQuiz,
  answerQuiz
};
