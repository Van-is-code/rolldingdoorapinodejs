const express = require('express');
const router = express.Router();
const WebSocket = require('ws'); // Import WebSocket để kiểm tra state
const { protect } = require('../middleware/auth'); // Middleware xác thực

// --- Kiểm tra xem các model có được require đúng không ---
let Log, Schedule;
try {
  Log = require('../models/Log');
  Schedule = require('../models/Schedule');
  if (!Log || !Schedule) {
    throw new Error('Models Log or Schedule could not be required.');
  }
  console.log('Models Log and Schedule loaded successfully in api.js.'); // Log thành công
} catch (modelError) {
  console.error('FATAL ERROR loading models in api.js:', modelError);
  throw new Error(`Failed to load models: ${modelError.message}`); // Dừng nếu lỗi model
}
// --- Kết thúc kiểm tra models ---

console.log('Initializing api router...'); // Log khi file được load

// === API Gửi Lệnh ===
// POST /api/command
router.post('/command', protect, async (req, res) => {
  const { action } = req.body;
  const esp32Socket = req.esp32Socket; // Lấy từ middleware trong server.js
  console.log(`Received command request: ${action} from user ${req.user.username}`); // Log request

  if (!['OPEN', 'CLOSE', 'STOP'].includes(action)) {
    console.warn(`Invalid action received: ${action}`);
    return res.status(400).json({ message: 'Lệnh không hợp lệ (Chỉ chấp nhận OPEN, CLOSE, STOP).' });
  }

  // --- Gửi lệnh qua WebSocket ---
  if (esp32Socket && esp32Socket.readyState === WebSocket.OPEN) {
    try {
      console.log(`Sending command "${action}" to ESP32 via WebSocket...`);
      // Gửi lệnh (dạng string)
      esp32Socket.send(action, async (err) => { // Thêm async cho callback
        if (err) {
          console.error(`Error sending WebSocket command "${action}":`, err);
        } else {
          console.log(`Command "${action}" sent successfully via WebSocket.`);
          // Ghi log chỉ KHI gửi thành công
          try {
            await Log.create({
              user: req.user.id,
              action: action,
              source: 'APP'
            });
            console.log(`Logged command action: ${action} for user ${req.user.username}`);
          } catch (logError) {
             console.error("Error logging command after successful send:", logError);
          }
        }
      });

      // Phản hồi cho client Flutter ngay lập tức
      res.status(200).json({ message: 'Yêu cầu gửi lệnh đã được thực hiện.' });

    } catch (error) { // Bắt lỗi đồng bộ
      console.error("Error processing command request:", error);
      res.status(500).json({ message: `Lỗi server khi xử lý lệnh: ${error.message}` });
    }
  } else {
    const reason = !esp32Socket ? "Không có kết nối ESP32." : `Kết nối ESP32 không mở (state: ${esp32Socket.readyState}).`;
    console.warn(`Cannot send command "${action}": ${reason}`);
    res.status(400).json({ message: `Thiết bị không kết nối hoặc chưa sẵn sàng. ${reason}` });
  }
  // --- Kết thúc gửi WebSocket ---
});

// === API Lịch Sử ===
// GET /api/logs
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

// === API Hẹn Giờ ===
// POST /api/schedules
router.post('/schedules', protect, async (req, res) => {
 const { action, cronTime } = req.body;
 const scheduler = req.scheduler;
 console.log(`Received POST /api/schedules request: ${action} ${cronTime} from user ${req.user.username}`);

 if (!action || !cronTime || !['OPEN', 'CLOSE', 'STOP'].includes(action)) {
     console.warn(`Invalid schedule data: action=${action}, cronTime=${cronTime}`);
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
 }
 if (cronTime.split(' ').length !== 5) {
     console.warn(`Invalid cronTime format: ${cronTime}`);
     return res.status(400).json({ message: 'Định dạng cronTime không hợp lệ.' });
 }

 try {
   const newSchedule = new Schedule({ user: req.user.id, action, cronTime });
   await newSchedule.save();
   scheduler.addJob(newSchedule);
   console.log(`Schedule added: ${newSchedule._id} for user ${req.user.username}`);
   res.status(201).json(newSchedule);
 } catch (error) {
   console.error("Error adding schedule:", error);
   if (error.name === 'ValidationError') {
       return res.status(400).json({ message: `Lỗi validation: ${error.message}` });
   }
   res.status(500).json({ message: `Lỗi server khi thêm lịch hẹn: ${error.message}` });
 }
});

// GET /api/schedules
router.get('/schedules', protect, async (req, res) => {
   console.log(`Received GET /api/schedules request from user ${req.user.username}`);
 try {
   const schedules = await Schedule.find({ user: req.user.id });
   res.json(schedules);
 } catch (error) {
    console.error("Error fetching schedules:", error);
   res.status(500).json({ message: `Lỗi server khi lấy danh sách lịch hẹn: ${error.message}` });
 }
});

// DELETE /api/schedules/:id
router.delete('/schedules/:id', protect, async (req, res) => {
 const scheduler = req.scheduler;
 const scheduleId = req.params.id;
  console.log(`Received DELETE /api/schedules/${scheduleId} request from user ${req.user.username}`);

 try {
   const schedule = await Schedule.findOneAndDelete({ _id: scheduleId, user: req.user.id });
   if (!schedule) {
     console.warn(`Schedule not found or permission denied for ID: ${scheduleId}, user: ${req.user.username}`);
     return res.status(404).json({ message: 'Không tìm thấy lịch hẹn hoặc bạn không có quyền xóa.' });
   }
   scheduler.removeJob(scheduleId);
   console.log(`Schedule deleted: ${scheduleId} by user ${req.user.username}`);
   res.json({ message: 'Xóa lịch hẹn thành công.' });
 } catch (error) {
    console.error("Error deleting schedule:", error);
    if (error.name === 'CastError') {
        return res.status(400).json({ message: 'ID lịch hẹn không hợp lệ.' });
    }
   res.status(500).json({ message: `Lỗi server khi xóa lịch hẹn: ${error.message}` });
 }
});

console.log('API router configuration complete.');
module.exports = router;