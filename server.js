require('dotenv').config(); // Đọc file .env
const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt'); // <<< Thư viện MQTT client
const connectDB = require('./config/db');
const Scheduler = require('./services/Scheduler');
const User = require('./models/User');

const app = express();

// --- Kết nối MQTT Client tới HiveMQ Cloud ---
// Kiểm tra biến môi trường
if (!process.env.HIVEMQ_CLUSTER_URL || !process.env.HIVEMQ_USERNAME || !process.env.HIVEMQ_PASSWORD) {
    console.error("LỖI: Vui lòng cung cấp HIVEMQ_CLUSTER_URL, HIVEMQ_USERNAME, và HIVEMQ_PASSWORD trong file .env!");
    process.exit(1);
}

const mqttOptions = {
  host: process.env.HIVEMQ_CLUSTER_URL,
  port: parseInt(process.env.HIVEMQ_PORT || '8883', 10), // Port TLS/SSL
  protocol: 'mqtts', // Sử dụng mqtts cho kết nối an toàn
  username: process.env.HIVEMQ_USERNAME,
  password: process.env.HIVEMQ_PASSWORD,
  clientId: `backend_nodejs_${Math.random().toString(16).substr(2, 8)}`, // ID ngẫu nhiên cho backend
  connectTimeout: 10000, // Tăng timeout lên 10 giây
  reconnectPeriod: 1000, // Thử kết nối lại mỗi giây
  clean: true, // Bắt đầu session mới mỗi lần kết nối
};

console.log(`Đang kết nối tới HiveMQ Broker: ${mqttOptions.protocol}://${mqttOptions.host}:${mqttOptions.port}`);
let mqttClient;
try {
    mqttClient = mqtt.connect(mqttOptions);
} catch (e) {
    console.error("Lỗi ngay khi gọi mqtt.connect:", e);
    process.exit(1);
}

// --- Các sự kiện của MQTT Client ---
mqttClient.on('connect', () => {
  console.log('>>> Đã kết nối thành công tới HiveMQ Broker!');
  // Không cần subscribe gì ở backend trong trường hợp này
});

mqttClient.on('reconnect', () => {
  console.log('MQTT Client đang thử kết nối lại...');
});

mqttClient.on('error', (error) => {
  console.error('Lỗi MQTT Client:', error.message);
});

mqttClient.on('close', () => {
  console.log('MQTT Client đã ngắt kết nối.');
});

mqttClient.on('offline', () => {
    console.log('MQTT Client đang offline.');
});

mqttClient.on('message', (topic, message) => {
  // Xử lý nếu backend có subscribe topic nào đó
  console.log(`Received message on topic ${topic}: ${message.toString()}`);
});
// --- Kết thúc MQTT Client ---


// Kết nối Database
connectDB();

// Khởi tạo Bộ hẹn giờ và truyền mqttClient vào
const scheduler = new Scheduler(mqttClient); // Truyền mqttClient
scheduler.start();

// Middlewares cho Express
app.use(cors());
app.use(express.json());

// Middleware để truyền mqttClient và scheduler vào các route
app.use((req, res, next) => {
  req.mqttClient = mqttClient; // <<< Truyền mqttClient
  req.scheduler = scheduler;
  next();
});

// Định nghĩa Routes Express
app.use('/auth', require('./routes/auth')); // Router xác thực giữ nguyên
app.use('/api', require('./routes/api'));   // Router API sẽ dùng mqttClient

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

// Khởi động API Server Express
const API_PORT = process.env.PORT || 3000;
app.listen(API_PORT, () => {
  console.log(`API Server đang chạy trên port ${API_PORT}`);
});