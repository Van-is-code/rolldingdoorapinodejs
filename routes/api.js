const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Log = require('../models/Log');
const Schedule = require('../models/Schedule');

const MQTT_TOPIC_COMMAND = 'door/command'; // Topic ESP32 lắng nghe

// === API Gửi Lệnh ===
// POST /api/command
router.post('/command', protect, async (req, res) => {
  const { action } = req.body; // "OPEN", "CLOSE", "STOP"
  const aedes = req.aedes; // Lấy MQTT broker từ middleware
  
  if (!['OPEN', 'CLOSE', 'STOP'].includes(action)) {
    return res.status(400).json({ message: 'Lệnh không hợp lệ.' });
  }

  try {
    // 1. Gửi lệnh qua MQTT
    aedes.publish({
      topic: MQTT_TOPIC_COMMAND,
      payload: action, // Gửi thẳng chuỗi "OPEN", "CLOSE" hoặc "STOP"
      qos: 1,
      retain: false
    });

    // 2. Ghi log
    await Log.create({
      user: req.user.id,
      action: action,
      source: 'APP'
    });

    res.status(200).json({ message: 'Đã gửi lệnh thành công.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

// === API Lịch Sử ===
// GET /api/logs
router.get('/logs', protect, async (req, res) => {
  try {
    // Lấy 50 log mới nhất của user
    const logs = await Log.find({ user: req.user.id })
      .sort({ timestamp: -1 }) // Sắp xếp mới nhất
      .limit(50)
      .populate('user', 'username'); // Lấy tên user
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

// === API Hẹn Giờ ===
// POST /api/schedules
router.post('/schedules', protect, async (req, res) => {
  const { action, cronTime } = req.body; // "CLOSE", "30 22 * * *"
  const scheduler = req.scheduler; // Lấy bộ hẹn giờ từ middleware

  try {
    const newSchedule = new Schedule({
      user: req.user.id,
      action,
      cronTime
    });
    await newSchedule.save();
    
    // Thêm job này vào bộ hẹn giờ đang chạy
    scheduler.addJob(newSchedule);

    res.status(201).json(newSchedule);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server, kiểm tra định dạng CronTime.' });
  }
});

// GET /api/schedules
router.get('/schedules', protect, async (req, res) => {
  try {
    const schedules = await Schedule.find({ user: req.user.id });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

// DELETE /api/schedules/:id
router.delete('/schedules/:id', protect, async (req, res) => {
  const scheduler = req.scheduler;
  try {
    const schedule = await Schedule.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.user.id // Đảm bảo user chỉ xóa được lịch của mình
    });

    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn.' });
    }

    // Xóa job này khỏi bộ hẹn giờ
    scheduler.removeJob(schedule._id.toString());
    
    res.json({ message: 'Xóa lịch hẹn thành công.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

module.exports = router;