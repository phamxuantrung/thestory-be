const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập username và password',
        data: null,
      });
    }

    const user = await User.findOne({ username }).populate(
      'partnerId',
      'displayName gender avatar bio isOnline lastSeen dailyMessage dailyMessageDate birthday'
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại',
        data: null,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Mật khẩu không đúng',
        data: null,
      });
    }

    const expiresIn = rememberMe ? '30d' : '2h';
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    // Cập nhật trạng thái online
    await User.findByIdAndUpdate(user._id, { isOnline: true });

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công 💕',
      data: {
        token,
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          gender: user.gender,
          avatar: user.avatar,
          anniversaryDate: user.anniversaryDate,
          birthday: user.birthday,
          bio: user.bio,
          partnerHobbies: user.partnerHobbies || [],
          dailyMessage: user.dailyMessage,
          dailyMessageDate: user.dailyMessageDate,
        },
        partner: user.partnerId,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      data: null,
    });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      isOnline: false,
      lastSeen: new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'Đã đăng xuất',
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      data: null,
    });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('partnerId', 'displayName gender avatar bio isOnline lastSeen dailyMessage dailyMessageDate birthday');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      message: 'OK',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      data: null,
    });
  }
};

const updateMe = async (req, res) => {
  try {
    const { anniversaryDate, birthday, dailyMessage, displayName, avatar, bio } = req.body;
    
    // Tìm và cập nhật user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    if (anniversaryDate !== undefined) {
      user.anniversaryDate = anniversaryDate;
      await user.save();

      // Cập nhật luôn cho partner nếu có
      if (user.partnerId) {
        const partner = await User.findById(user.partnerId);
        if (partner) {
          partner.anniversaryDate = anniversaryDate;
          await partner.save();
        }
      }
    }

    if (birthday !== undefined) {
      user.birthday = birthday;
      await user.save();
    }

    if (dailyMessage !== undefined) {
      user.dailyMessage = dailyMessage;
      user.dailyMessageDate = new Date();
      await user.save();
    }

    if (displayName !== undefined) {
      user.displayName = displayName;
      await user.save();
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
      await user.save();
    }

    if (bio !== undefined) {
      if (bio.length > 300) {
        return res.status(400).json({ success: false, message: 'Mô tả không được vượt quá 300 ký tự' });
      }
      user.bio = bio;
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật thành công',
      data: { 
        anniversaryDate: user.anniversaryDate, 
        birthday: user.birthday,
        dailyMessage: user.dailyMessage, 
        dailyMessageDate: user.dailyMessageDate,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      data: null,
    });
  }
};

// PUT /api/auth/me/partner-hobbies
const updatePartnerHobbies = async (req, res) => {
  try {
    const { hobbies } = req.body;
    
    if (!Array.isArray(hobbies)) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
    }

    const formattedHobbies = hobbies.map(h => {
      if (typeof h === 'string') {
        return { category: 'other', text: h };
      }
      return h;
    });

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    user.partnerHobbies = formattedHobbies;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật sở thích thành công',
      data: { partnerHobbies: user.partnerHobbies }
    });
  } catch (error) {
    console.error('Update hobbies error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      data: null,
    });
  }
};

// POST /api/auth/me/avatar
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy file ảnh' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    user.avatar = req.file.path;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật ảnh đại diện thành công',
      data: { avatar: user.avatar }
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// PUT /api/auth/me/password
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ mật khẩu cũ và mới' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu cũ không chính xác' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công',
      data: null
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = { login, logout, getMe, updateMe, updatePartnerHobbies, uploadAvatar, changePassword };
