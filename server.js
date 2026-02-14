require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mqtt = require("mqtt");
const { sequelize, connectDB } = require("./config/db");
const Scheduler = require("./services/Scheduler");

// Import all models
const User = require("./models/User");
const Schedule = require("./models/Schedule");
const Log = require("./models/Log");

const app = express();

// --- Kết nối MQTT Client tới HiveMQ Cloud ---
if (!process.env.HIVEMQ_CLUSTER_URL || !process.env.HIVEMQ_USERNAME || !process.env.HIVEMQ_PASSWORD) {
  console.error("LỖI: Vui lòng cung cấp HIVEMQ_CLUSTER_URL, HIVEMQ_USERNAME, và HIVEMQ_PASSWORD trong file .env!");
  process.exit(1);
}

const mqttOptions = {
  host: process.env.HIVEMQ_CLUSTER_URL,
  port: parseInt(process.env.HIVEMQ_PORT || "8883", 10),
  protocol: "mqtts",
  username: process.env.HIVEMQ_USERNAME,
  password: process.env.HIVEMQ_PASSWORD,
  clientId: `backend_nodejs_${Math.random().toString(16).substr(2, 8)}`,
  connectTimeout: 10000,
  reconnectPeriod: 1000,
  clean: true,
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
mqttClient.on("connect", () => {
  console.log(">>> Đã kết nối thành công tới HiveMQ Broker!");
});

mqttClient.on("reconnect", () => {
  console.log("MQTT Client đang thử kết nối lại...");
});

mqttClient.on("error", (error) => {
  console.error("Lỗi MQTT Client:", error.message);
});

mqttClient.on("close", () => {
  console.log("MQTT Client đã ngắt kết nối.");
});

mqttClient.on("offline", () => {
  console.log("MQTT Client đang offline.");
});

mqttClient.on("message", (topic, message) => {
  console.log(`Received message on topic ${topic}: ${message.toString()}`);
});
// --- Kết thúc MQTT Client ---

// Kết nối Database
connectDB();

// Khởi tạo Bộ hẹn giờ và truyền mqttClient vào
const scheduler = new Scheduler(mqttClient);
scheduler.start();

// Middlewares cho Express
app.use(cors());
app.use(express.json());

// Middleware để truyền mqttClient và scheduler vào các route
app.use((req, res, next) => {
  req.mqttClient = mqttClient;
  req.scheduler = scheduler;
  next();
});

// Định nghĩa Routes Express
app.use("/auth", require("./routes/auth"));
app.use("/api", require("./routes/api"));

// Tạo tài khoản Admin
const createAdminAccount = async () => {
  try {
    const adminUser = await User.findOne({ where: { role: "admin" } });
    if (!adminUser && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
      const newUser = await User.create({
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
        role: "admin",
      });
      console.log("Tài khoản Admin mặc định đã được tạo.");
    }
  } catch (error) {
    console.error("Lỗi khi tạo tài khoản Admin:", error);
  }
};
createAdminAccount();

// Khởi động API Server Express
const API_PORT = process.env.PORT || 3000;
app.listen(API_PORT, () => {
  console.log(`API Server đang chạy trên port ${API_PORT}`);
});
