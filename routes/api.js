const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth'); // Middleware xác thực

// --- Kiểm tra models ---
let Log, Schedule;
try {
  Log = require('../models/Log');
  Schedule = require('../models/Schedule');
  if (!Log || !Schedule) { throw new Error('Models missing.'); }
  console.log('Models loaded successfully in api.js.');
} catch (modelError) {
  console.error('FATAL ERROR loading models in api.js:', modelError);
  throw new Error(`Failed to load models: ${modelError.message}`);
}
// --- ---

console.log('Initializing api router...');

const MQTT_TOPIC_COMMAND = 'door/command'; // Topic để publish lệnh

// === API Gửi Lệnh ===
// POST /api/command
router.post('/command', protect, async (req, res) => {
  const { action } = req.body;
  const mqttClient = req.mqttClient; // Lấy MQTT client từ middleware
  console.log(`Received command request: ${action} from user ${req.user.username}`);

  if (!['OPEN', 'CLOSE', 'STOP'].includes(action)) {
    console.warn(`Invalid action: ${action}`);
    return res.status(400).json({ message: 'Lệnh không hợp lệ.' });
  }

  // --- Gửi lệnh qua MQTT tới HiveMQ ---
  if (mqttClient && mqttClient.connected) {
    try {
      console.log(`Publishing command "${action}" to topic ${MQTT_TOPIC_COMMAND}...`);
      // Publish lệnh, QoS 1
      mqttClient.publish(MQTT_TOPIC_COMMAND, action, { qos: 1 }, async (err) => {
        if (err) {
          console.error(`Error publishing MQTT command "${action}":`, err);
           if (!res.headersSent) {
             res.status(500).json({ message: `Lỗi khi gửi lệnh MQTT: ${err.message}` });
           }
        } else {
          console.log(`Command "${action}" published successfully.`);
          // Ghi log sau khi publish thành công
          try {
            await Log.create({
              user: req.user.id,
              action: action,
              source: 'APP'
            });
            console.log(`Logged command action: ${action} for user ${req.user.username}`);
            if (!res.headersSent) {
               res.status(200).json({ message: 'Đã gửi lệnh thành công.' });
            }
          } catch (logError) {
             console.error("Error logging command after successful publish:", logError);
              if (!res.headersSent) {
                 res.status(500).json({ message: 'Lệnh đã được gửi nhưng ghi log thất bại.' });
              }
          }
        }
      });
      // Callback của publish sẽ xử lý response, không cần trả về ngay ở đây

    } catch (error) { // Bắt lỗi đồng bộ
      console.error("Error preparing MQTT publish:", error);
       if (!res.headersSent) {
          res.status(500).json({ message: `Lỗi server khi chuẩn bị gửi lệnh: ${error.message}` });
       }
    }
  } else {
    const reason = !mqttClient ? "MQTT client chưa khởi tạo." : "MQTT client không kết nối.";
    console.warn(`Cannot send command "${action}": ${reason}`);
    res.status(500).json({ message: `Không thể gửi lệnh: ${reason}` }); // Lỗi 500
  }
  // --- Kết thúc gửi MQTT ---
});

// === API Lịch Sử (Giữ nguyên) ===
router.get('/logs', protect, async (req, res) => {
   console.log(`Received GET /api/logs request from user ${req.user.username}`);
  try {
    const logs = await Log.find({ user: req.user.id })
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('user', 'username');
    res.json(logs);
  } catch (error) {
     console.error("Error fetching logs:", error);
    res.status(500).json({ message: `Lỗi server khi lấy lịch sử: ${error.message}` });
  }
});

// === API Hẹn Giờ (Giữ nguyên) ===
router.post('/schedules', protect, async (req, res) => {
    const { action, cronTime } = req.body;
    const scheduler = req.scheduler;
    console.log(`Received POST /api/schedules request: ${action} ${cronTime} from user ${req.user.username}`);
    if (!action || !cronTime || !['OPEN', 'CLOSE', 'STOP'].includes(action)) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    if (cronTime.split(' ').length !== 5) return res.status(400).json({ message: 'Định dạng cronTime không hợp lệ.' });
    try {
        const newSchedule = new Schedule({ user: req.user.id, action, cronTime });
        await newSchedule.save();
        scheduler.addJob(newSchedule);
        console.log(`Schedule added: ${newSchedule._id} for user ${req.user.username}`);
        res.status(201).json(newSchedule);
    } catch (error) { /* ... (Xử lý lỗi giữ nguyên) ... */ }
});
router.get('/schedules', protect, async (req, res) => {
    console.log(`Received GET /api/schedules request from user ${req.user.username}`);
    try { /* ... (Logic lấy lịch giữ nguyên) ... */ }
    catch (error) { /* ... (Xử lý lỗi giữ nguyên) ... */ }
});
router.delete('/schedules/:id', protect, async (req, res) => {
    const scheduler = req.scheduler;
    const scheduleId = req.params.id;
    console.log(`Received DELETE /api/schedules/${scheduleId} request from user ${req.user.username}`);
    try { /* ... (Logic xóa lịch giữ nguyên) ... */ }
    catch (error) { /* ... (Xử lý lỗi giữ nguyên) ... */ }
});

console.log('API router configuration complete.');
module.exports = router;