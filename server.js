require('dotenv').config(); // Đọc file .env
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { createMqttBroker } = require('./services/MqttBroker');
const Scheduler = require('./services/Scheduler');
const User = require('./models/User'); // Import model User

const app = express();

// Kết nối Database
connectDB();

// Khởi tạo MQTT Broker
const { aedes, mqttServer } = createMqttBroker(process.env.MQTT_PORT);

// Khởi tạo Bộ hẹn giờ và truyền aedes vào
const scheduler = new Scheduler(aedes);
scheduler.start(); // Bắt đầu quét các lịch hẹn

// Middlewares
app.use(cors()); // Cho phép Flutter gọi
app.use(express.json()); // Đọc body dạng JSON

// Middleware để truyền aedes và scheduler vào các route
// Bằng cách này, các API có thể publish MQTT hoặc thêm/xóa lịch hẹn
app.use((req, res, next) => {
  req.aedes = aedes;
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


// Khởi động API Server
const API_PORT = process.env.PORT || 3000;
app.listen(API_PORT, () => {
  console.log(`API Server đang chạy trên port ${API_PORT}`);
});

// MQTT Server đã được khởi động bên trong MqttBroker.js