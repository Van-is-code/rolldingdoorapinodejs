require('dotenv').config(); // Đọc file .env
const express = require('express');
const http = require('http'); // Thêm module http
const WebSocket = require('ws'); // Thêm module ws
const cors = require('cors');
const connectDB = require('./config/db');
// Bỏ import MqttBroker
const Scheduler = require('./services/Scheduler');
const User = require('./models/User'); // Import model User

const app = express();
const server = http.createServer(app); // Tạo HTTP server từ Express app

// Kết nối Database
connectDB();

// --- Khởi tạo WebSocket Server ---
const wss = new WebSocket.Server({ server }); // Gắn WebSocket server vào HTTP server

// Lưu trữ các kết nối ESP32 (đơn giản, có thể cải tiến sau)
let esp32Socket = null; // Giả sử chỉ có 1 ESP32

wss.on('connection', (ws) => {
  console.log('Client WebSocket connected');
  // Giả định client kết nối là ESP32 (cần cơ chế xác thực tốt hơn sau này)
  esp32Socket = ws;

  ws.on('message', (message) => {
    // Xử lý message từ ESP32 nếu cần (ví dụ: báo trạng thái)
    console.log('Received from ESP32:', message.toString());
  });

  ws.on('close', () => {
    console.log('Client WebSocket disconnected');
    if (esp32Socket === ws) {
      esp32Socket = null; // Xóa tham chiếu khi ESP32 ngắt kết nối
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket Error:', error);
    if (esp32Socket === ws) {
      esp32Socket = null;
    }
  });
});
// --- Kết thúc WebSocket Server ---


// Khởi tạo Bộ hẹn giờ và truyền wss vào
const scheduler = new Scheduler(wss); // Truyền wss thay vì aedes
scheduler.start(); // Bắt đầu quét các lịch hẹn

// Middlewares
app.use(cors()); // Cho phép Flutter gọi
app.use(express.json()); // Đọc body dạng JSON

// Middleware để truyền wss và scheduler vào các route
app.use((req, res, next) => {
  // req.aedes = aedes; // Bỏ dòng này
  req.wss = wss;        // Thêm dòng này để API có thể truy cập wss
  req.esp32Socket = esp32Socket; // Truyền socket ESP32 hiện tại
  req.scheduler = scheduler;
  next();
});

// Định nghĩa Routes
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));

// Tự động tạo tài khoản Admin khi khởi động (nếu chưa có)
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


// Khởi động HTTP Server (bao gồm cả WebSocket)
const API_PORT = process.env.PORT || 3000;
server.listen(API_PORT, () => { // Dùng server.listen thay vì app.listen
  console.log(`API Server & WebSocket đang chạy trên port ${API_PORT}`);
});

// Bỏ phần khởi động MQTT Server cũ
