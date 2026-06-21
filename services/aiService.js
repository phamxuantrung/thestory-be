const { GoogleGenerativeAI } = require('@google/generative-ai');

// Khởi tạo Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');

const generateCoupleQuests = async (hobbies, recentQuestTitles, count = 5, userBio = '', partnerBio = '') => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
Bạn là một AI chuyên sáng tạo các "Thử thách tình yêu" hàng tuần (Couple Quests) cho các cặp đôi yêu nhau.
Dưới đây là danh sách các sở thích của cặp đôi này:
${hobbies && hobbies.length > 0 ? hobbies.map(h => `- ${h.text} (${h.category})`).join('\n') : '- Chưa có thông tin sở thích.'}

Mô tả tính cách / bản thân của họ:
- Người 1: ${userBio || 'Không có mô tả'}
- Người 2: ${partnerBio || 'Không có mô tả'}

Để tránh lặp lại, đây là các thử thách họ đã làm gần đây (Hãy tránh tạo lại các thử thách này):
${recentQuestTitles && recentQuestTitles.length > 0 ? recentQuestTitles.map(t => `- ${t}`).join('\n') : '- (Chưa có lịch sử)'}

Hãy tạo ra ĐÚNG ${count} thử thách lãng mạn, thú vị và thực tế để cặp đôi cùng thực hiện trong tuần này.
Cơ cấu nhiệm vụ (nếu tạo đủ 5 nhiệm vụ):
- 3 thử thách DỰA TRÊN sở thích đã cung cấp ở trên.
- 2 thử thách MỚI LẠ VÀ SÁNG TẠO TỰ DO (không nhất thiết liên quan đến sở thích) để làm mới tình cảm.
(Nếu count ít hơn 5, hãy cân đối ngẫu nhiên giữa 2 loại trên).

Yêu cầu:
- Thử thách phải cụ thể, dễ thực hiện, giúp tăng sự gắn kết.
- Dựa vào sở thích và đặc điểm tính cách của họ để thiết kế thử thách phù hợp (nếu có thông tin).
- Trả về kết quả dưới dạng mảng JSON chứa ${count} object, mỗi object có định dạng: 
  {
    "title": "Tên thử thách ngắn gọn (tối đa 10 chữ)",
    "description": "Mô tả chi tiết cách thực hiện (khoảng 1-2 câu)",
    "expReward": "Số từ 50 đến 150",
    "coinReward": "Số từ 10 đến 30"
  }
Không xuất ra bất kỳ text nào khác ngoài chuỗi JSON chuẩn.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Parse JSON
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      if (!text.startsWith('[')) {
        const startIdx = text.indexOf('[');
        const endIdx = text.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
          text = text.substring(startIdx, endIdx + 1);
        }
      }
      parsed = JSON.parse(text);
    } catch (e) {
      console.log('Original AI Text:', response.text());
      throw new Error('Failed to parse AI JSON response');
    }

    if (parsed && !Array.isArray(parsed) && parsed.quests && Array.isArray(parsed.quests)) {
      parsed = parsed.quests;
    } else if (parsed && !Array.isArray(parsed) && parsed.challenges && Array.isArray(parsed.challenges)) {
      parsed = parsed.challenges;
    }

    if (!Array.isArray(parsed)) {
      console.log('AI returned non-array:', parsed);
      // Giả mạo 1 mảng nếu nó trả về 1 object duy nhất
      if (typeof parsed === 'object') {
        parsed = [parsed];
      } else {
        throw new Error('AI không trả về mảng JSON hợp lệ');
      }
    }

    return parsed;
  } catch (error) {
    console.error('Error generating quests via Gemini:', error);
    throw error;
  }
};

module.exports = {
  generateCoupleQuests
};
