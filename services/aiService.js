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

const generateTelepathyQuestion = async (pastQuestions = []) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
Bạn là một AI tạo câu hỏi "Thần giao cách cảm" (Telepathy Quiz) cho các cặp đôi.
Mục tiêu: Đưa ra 2 tuỳ chọn (A và B) để xem 2 người có chọn giống nhau không.
Yêu cầu:
- 2 tuỳ chọn phải phổ biến, quen thuộc, dễ lựa chọn nhưng gây chia rẽ sở thích (VD: Chó - Mèo, Biển - Núi, Trà sữa - Cà phê, Mùa hè - Mùa đông, Marvel - DC).
- Không được trùng lặp với các câu hỏi trước đây: ${pastQuestions.length > 0 ? pastQuestions.join(', ') : 'Chưa có'}.
- Hãy sáng tạo và đa dạng chủ đề (Đồ ăn, Du lịch, Thói quen, Sở thích, Phim ảnh).
- Từ ngữ ngắn gọn, tối đa 3-4 chữ mỗi tuỳ chọn.

Trả về một JSON có định dạng:
{
  "optionA": "Tuỳ chọn 1",
  "optionB": "Tuỳ chọn 2"
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Lỗi khi tạo câu hỏi thần giao cách cảm:', error);
    return { optionA: 'Chó', optionB: 'Mèo' }; // Fallback
  }
};

const generateDailyNumerology = async (energyNumber, userBio = '', partnerBio = '') => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
Bạn là một chuyên gia Thần số học phương Tây.
Năng lượng chung của cặp đôi trong ngày hôm nay là số: ${energyNumber}.
Thông tin của hai người:
- Người 1: ${userBio || 'Không có mô tả'}
- Người 2: ${partnerBio || 'Không có mô tả'}

Dựa vào ý nghĩa của số ${energyNumber} trong Thần số học (Ví dụ: 1-Khởi đầu, 2-Kết nối, 3-Sáng tạo, 4-Ổn định, 5-Thay đổi, 6-Chăm sóc gia đình, 7-Suy ngẫm, 8-Tài chính/Tham vọng, 9-Kết thúc/Cho đi, 11-Tâm linh, 22-Kiến tạo) và tính cách của hai người.

Hãy trả về một chuỗi JSON chuẩn có định dạng:
{
  "meaning": "Tên chủ đề ngắn gọn của ngày hôm nay (VD: Ngày của sự chăm sóc)",
  "advice": "Lời giải thích ngắn gọn về năng lượng hôm nay ảnh hưởng thế nào đến tình cảm của hai người (khoảng 2 câu).",
  "actionPrompt": "Gợi ý 1 hành động cụ thể và lãng mạn mà cả hai nên làm cùng nhau hôm nay để thu hút may mắn (khoảng 1 câu)."
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Lỗi khi tạo Thần số học:', error);
    return {
      meaning: "Ngày của kết nối",
      advice: "Năng lượng hôm nay khuyến khích sự thấu hiểu và chia sẻ.",
      actionPrompt: "Hãy dành thời gian để lắng nghe nhau nhiều hơn."
    };
  }
};

module.exports = {
  generateCoupleQuests,
  generateTelepathyQuestion,
  generateDailyNumerology
};
