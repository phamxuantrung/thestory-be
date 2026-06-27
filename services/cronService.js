const cron = require('node-cron');
const LoveTree = require('../models/LoveTree');
const { evaluateTreeState } = require('./treeEvaluationService');

const startCronJobs = (app) => {
  // Chạy mỗi giờ vào phút thứ 0 (0 * * * *)
  // Sẽ kiểm tra trạng thái toàn bộ cây đang trồng
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('🌳 [Cron Job] Đang chạy trình tự động đánh giá Cây Tình Yêu...');
      const trees = await LoveTree.find({ isPlanted: true });
      
      const io = app.get('io');
      let changedCount = 0;

      for (let tree of trees) {
        const isChanged = await evaluateTreeState(tree, io);
        if (isChanged) {
          changedCount++;
        }
      }

      console.log(`🌳 [Cron Job] Đã kiểm tra ${trees.length} cây. Cập nhật trạng thái cho ${changedCount} cây.`);
    } catch (error) {
      console.error('🌳 [Cron Job] Lỗi khi chạy đánh giá cây:', error);
    }
  });

  console.log('⏰ Cron Job cho Cây Tình Yêu đã được khởi chạy! (Mỗi giờ 1 lần)');
};

module.exports = {
  startCronJobs
};
