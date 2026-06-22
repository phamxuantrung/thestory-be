const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config(); // Load env vars first!

const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/authRoutes');
const memoryRoutes = require('./routes/memoryRoutes');
const chatRoutes = require('./routes/chatRoutes');
const stickerRoutes = require('./routes/stickerRoutes');
const futureLetterRoutes = require('./routes/futureLetterRoutes');
const moodRoutes = require('./routes/moodRoutes');
const locationRoutes = require('./routes/locationRoutes');
const treeRoutes = require('./routes/treeRoutes');
const questRoutes = require('./routes/quests');
const seedUsers = require('./utils/seedUsers');
const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Tạo thư mục uploads nếu chưa có
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/stickers', stickerRoutes);
app.use('/api/future-letters', futureLetterRoutes);
app.use('/api/moods', moodRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/tree', treeRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('<h1>💕 TheStory Backend is running!</h1>');
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '💕 TheStory API is running!' });
});

// Socket.IO — Realtime couple status

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // User đăng nhập vào socket
  socket.on('user:join', async (userId) => {
    socket.join(userId);
    socket.userId = userId;

    // Cập nhật online trong DB
    await User.findByIdAndUpdate(userId, { isOnline: true });

    // Thông báo cho partner
    const user = await User.findById(userId).populate('partnerId', '_id');
    if (user && user.partnerId) {
      io.to(user.partnerId._id.toString()).emit('partner:online', {
        userId,
        isOnline: true,
        timestamp: new Date(),
      });
    }
    console.log(`💕 User ${userId} online`);
  });

  // Memory mới được tạo — notify partner
  socket.on('memory:created', async (data) => {
    const user = await User.findById(data.createdBy).populate('partnerId', '_id');
    if (user && user.partnerId) {
      io.to(user.partnerId._id.toString()).emit('memory:new', data);
    }
  });

  // ==================== CHAT EVENTS ====================

  // Gửi tin nhắn real-time
  socket.on('chat:send', async (data) => {
    try {
      const { content, type = 'text', replyTo, mediaUrl, mediaPublicId, _preloaded } = data;

      if (_preloaded) {
        // Media was already saved via REST and shown optimistically on sender's screen
        // Only notify the partner
        const senderUser = await User.findById(socket.userId).populate('partnerId', '_id');
        if (senderUser && senderUser.partnerId) {
          io.to(senderUser.partnerId._id.toString()).emit('chat:message', _preloaded);
        }
        return; // skip normal broadcast
      }

      // Text message — save to DB
      const message = await Message.create({
        sender: socket.userId,
        content: content || '',
        type,
        mediaUrl: mediaUrl || null,
        mediaPublicId: mediaPublicId || null,
        replyTo: replyTo || null,
      });
      const populated = await Message.findById(message._id)
        .populate('sender', 'displayName gender avatar')
        .populate('replyTo', 'content sender type mediaUrl');

      // Echo lại cho chính mình (tất cả các thiết bị)
      io.to(socket.userId).emit('chat:message', populated);

      // Gửi cho partner
      const user = await User.findById(socket.userId).populate('partnerId', '_id');
      if (user && user.partnerId) {
        io.to(user.partnerId._id.toString()).emit('chat:message', populated);
      }
    } catch (err) {
      console.error('chat:send error:', err);
    }
  });

  // Typing indicator
  socket.on('chat:typing', async ({ isTyping }) => {
    const user = await User.findById(socket.userId).populate('partnerId', '_id');
    if (user && user.partnerId) {
      io.to(user.partnerId._id.toString()).emit('chat:typing', { isTyping, userId: socket.userId });
    }
  });

  // Đã đọc
  socket.on('chat:seen', async () => {
    try {
      // Update DB
      await Message.updateMany(
        { isRead: false, sender: { $ne: socket.userId } },
        { isRead: true }
      );

      const user = await User.findById(socket.userId).populate('partnerId', '_id');
      if (user && user.partnerId) {
        io.to(user.partnerId._id.toString()).emit('chat:seen', { seenBy: socket.userId });
      }
    } catch (err) {
      console.error('chat:seen error:', err);
    }
  });

  // React emoji
  socket.on('chat:react', async ({ messageId, emoji }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;
      const userId = socket.userId;
      const existingIdx = msg.reactions.findIndex((r) => r.userId.toString() === userId);
      if (existingIdx > -1) {
        if (msg.reactions[existingIdx].emoji === emoji) {
          msg.reactions.splice(existingIdx, 1);
        } else {
          msg.reactions[existingIdx].emoji = emoji;
        }
      } else {
        msg.reactions.push({ userId, emoji });
      }
      await msg.save();

      const payload = { messageId, reactions: msg.reactions };
      io.to(socket.userId).emit('chat:reacted', payload);
      
      const user = await User.findById(socket.userId).populate('partnerId', '_id');
      if (user && user.partnerId) {
        io.to(user.partnerId._id.toString()).emit('chat:reacted', payload);
      }
    } catch (err) { console.error('chat:react error:', err); }
  });

  // Pin message
  socket.on('chat:pin', async ({ messageId }) => {
    try {
      await Message.updateMany({ isPinned: true }, { isPinned: false });
      const msg = await Message.findByIdAndUpdate(messageId, { isPinned: true }, { new: true })
        .populate('sender', 'displayName');
      const payload = { pinnedMessage: msg };
      io.to(socket.userId).emit('chat:pinned', payload);
      
      const user = await User.findById(socket.userId).populate('partnerId', '_id');
      if (user && user.partnerId) {
        io.to(user.partnerId._id.toString()).emit('chat:pinned', payload);
      }
    } catch (err) { console.error('chat:pin error:', err); }
  });

  // Unpin message
  socket.on('chat:unpin', async () => {
    try {
      await Message.updateMany({ isPinned: true }, { isPinned: false });
      io.to(socket.userId).emit('chat:unpinned');
      
      const user = await User.findById(socket.userId).populate('partnerId', '_id');
      if (user && user.partnerId) {
        io.to(user.partnerId._id.toString()).emit('chat:unpinned');
      }
    } catch (err) { console.error('chat:unpin error:', err); }
  });

  // Poke / Nhớ em
  socket.on('chat:poke', async () => {
    const user = await User.findById(socket.userId).populate('partnerId', '_id');
    if (user && user.partnerId) {
      io.to(user.partnerId._id.toString()).emit('chat:poke', {
        from: socket.userId,
        displayName: user.displayName,
      });
    }
  });

  // Xóa tin nhắn (broadcast đến partner)
  socket.on('chat:delete', async ({ messageId }) => {
    const user = await User.findById(socket.userId).populate('partnerId', '_id');
    if (user && user.partnerId) {
      io.to(user.partnerId._id.toString()).emit('chat:deleted', { messageId });
    }
  });

  // ==================== MEMORY EVENTS ====================

  // Memory được like
  socket.on('memory:liked', async (data) => {
    const user = await User.findById(data.userId).populate('partnerId', '_id');
    if (user && user.partnerId) {
      io.to(user.partnerId._id.toString()).emit('memory:liked', data);
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    if (socket.userId) {
      try {
        const sockets = await io.in(socket.userId).fetchSockets();
        // If no more sockets for this user, mark as offline
        if (sockets.length === 0) {
          await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            lastSeen: new Date(),
          });

          // Thông báo partner offline
          const user = await User.findById(socket.userId).populate('partnerId', '_id');
          if (user && user.partnerId) {
            io.to(user.partnerId._id.toString()).emit('partner:online', {
              userId: socket.userId,
              isOnline: false,
              lastSeen: new Date(),
            });
          }
        }
      } catch (err) {
        console.error('disconnect error:', err);
      }
    }
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Connect MongoDB & Start server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected!');
    await seedUsers();

    server.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
      console.log(`💕 TheStory API ready!`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
