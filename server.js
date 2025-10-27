require('dotenv').config(); // Đọc file .env
const express = require('express');
const http = require('http'); // Sử dụng module http gốc
const WebSocket = require('ws'); // Thư viện WebSocket
const cors = require('cors');
const connectDB = require('./config/db');
// Bỏ import MqttBroker
const Scheduler = require('./services/Scheduler');
const User = require('./models/User');

const app = express();
// Tạo HTTP server từ Express app để WebSocket có thể gắn vào
const server = http.createServer(app);

// Kết nối Database
connectDB();

// --- Khởi tạo WebSocket Server (WSS) ---
// Gắn WebSocket server vào HTTP server đã tạo
const wss = new WebSocket.Server({ server });
console.log('WebSocket Server is initializing...');

// Biến để lưu trữ kết nối của ESP32 (cách đơn giản nhất)
let esp32Socket = null;

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`Client WebSocket connected from ${clientIp}`);

  // Giả định client kết nối là ESP32 và chỉ có 1 ESP32
  if (esp32Socket && esp32Socket.readyState === WebSocket.OPEN) {
     console.warn("Một ESP32 khác đang cố kết nối trong khi đã có kết nối! Đóng kết nối cũ.");
     esp32Socket.terminate(); // Đóng kết nối cũ
  }
  esp32Socket = ws;
  console.log('ESP32 WebSocket assigned.');

  // Lắng nghe tin nhắn từ client (ESP32)
  ws.on('message', (message) => {
    try {
      const messageString = message.toString();
      console.log('Received from ESP32:', messageString);
      // Xử lý tin nhắn từ ESP32 nếu cần
    } catch (e) {
      console.error('Error processing message from ESP32:', e);
    }
  });

  // Xử lý khi client đóng kết nối
  ws.on('close', (code, reason) => {
    const reasonString = reason ? reason.toString() : 'N/A';
    console.log(`Client WebSocket disconnected. Code: ${code}, Reason: ${reasonString}`);
    if (esp32Socket === ws) {
      esp32Socket = null; // Xóa tham chiếu
      console.log('ESP32 WebSocket reference cleared.');
    }
  });

  // Xử lý lỗi kết nối
  ws.on('error', (error) => {
    console.error(`WebSocket Error for client ${clientIp}:`, error);
    if (esp32Socket === ws) {
      esp32Socket = null;
       console.log('ESP32 WebSocket reference cleared due to error.');
    }
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        console.log(`Terminating WebSocket connection for ${clientIp} due to error.`);
        ws.terminate();
    }
  });
});

wss.on('error', (error) => {
   console.error('WebSocket Server Error:', error);
});

console.log('WebSocket Server event listeners attached.');
// --- Kết thúc WebSocket Server ---


// Khởi tạo Bộ hẹn giờ và truyền wss vào
const scheduler = new Scheduler(wss);
scheduler.start();

// Middlewares cho Express
app.use(cors());
app.use(express.json());

// Middleware để truyền wss và esp32Socket vào các route handler của Express
app.use((req, res, next) => {
  req.wss = wss;
  req.esp32Socket = esp32Socket;
  req.scheduler = scheduler;
  next();
});

// Định nghĩa Routes Express
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));

// Tạo tài khoản Admin (Giữ nguyên)
const createAdminAccount = async () => {
  try {
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
      const newUser = new User({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
        role: 'admin'
      });
      await newUser.save();
      console.log('Tài khoản Admin mặc định đã được tạo.');
    }
  } catch (error) {
    console.error('Lỗi khi tạo tài khoản Admin:', error);
  }
};
createAdminAccount();

// Khởi động HTTP Server (Express + WebSocket)
const API_PORT = process.env.PORT || 3000;
server.listen(API_PORT, () => {
  console.log(`API Server & WebSocket đang chạy trên port ${API_PORT}`);
});