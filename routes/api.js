const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Log = require('../models/Log');
const Schedule = require('../models/Schedule');

// Bỏ MQTT_TOPIC_COMMAND

// === API Gửi Lệnh ===
// POST /api/command
router.post('/command', protect, async (req, res) => {
  const { action } = req.body; // "OPEN", "CLOSE", "STOP"
  // const aedes = req.aedes; // Bỏ MQTT broker
  const esp32Socket = req.esp32Socket; // Lấy socket ESP32 từ middleware

  if (!['OPEN', 'CLOSE', 'STOP'].includes(action)) {
    return res.status(400).json({ message: 'Lệnh không hợp lệ.' });
  }

  // --- Gửi lệnh qua WebSocket ---
  if (esp32Socket && esp32Socket.readyState === WebSocket.OPEN) { // WebSocket phải đang mở
     try {
        console.log(`Gửi lệnh "${action}" tới ESP32 qua WebSocket...`);
        esp32Socket.send(action); // Gửi thẳng chuỗi lệnh

        // Ghi log sau khi gửi thành công
         await Log.create({
           user: req.user.id,
           action: action,
           source: 'APP'
         });

        res.status(200).json({ message: 'Đã gửi lệnh thành công.' });
     } catch (sendError) {
        console.error("Lỗi khi gửi WebSocket:", sendError);
        res.status(500).json({ message: 'Lỗi server khi gửi lệnh WebSocket.' });
     }
  } else {
     console.warn("Không có kết nối ESP32 WebSocket hoặc kết nối đã đóng.");
     res.status(400).json({ message: 'Thiết bị ESP32 không kết nối. Không thể gửi lệnh.' });
  }
  // --- Kết thúc gửi WebSocket ---

  /* // Bỏ phần gửi MQTT cũ
  try {
    // 1. Gửi lệnh qua MQTT
    aedes.publish({ ... });
    // 2. Ghi log
    await Log.create({ ... });
    res.status(200).json({ message: 'Đã gửi lệnh thành công.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server.' });
  }
  */
});

// === API Lịch Sử (Giữ nguyên) ===
router.get('/logs', protect, async (req, res) => {
  // ... (Giữ nguyên code)
});

// === API Hẹn Giờ (Giữ nguyên logic routes, chỉ thay đổi cách Scheduler gửi lệnh) ===
router.post('/schedules', protect, async (req, res) => {
 // ... (Giữ nguyên code)
});

router.get('/schedules', protect, async (req, res) => {
  // ... (Giữ nguyên code)
});

router.delete('/schedules/:id', protect, async (req, res) => {
  // ... (Giữ nguyên code)
});

module.exports = router;
