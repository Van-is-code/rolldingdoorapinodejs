const express = require('express');
const router = express.Router();
const WebSocket = require('ws'); // <<< THÊM DÒNG NÀY
const { protect } = require('../middleware/auth');
const Log = require('../models/Log');
const Schedule = require('../models/Schedule');

// === API Gửi Lệnh ===
// POST /api/command
router.post('/command', protect, async (req, res) => {
  const { action } = req.body;
  const esp32Socket = req.esp32Socket;

  if (!['OPEN', 'CLOSE', 'STOP'].includes(action)) {
    return res.status(400).json({ message: 'Lệnh không hợp lệ.' });
  }

  // --- Gửi lệnh qua WebSocket ---
  // Kiểm tra esp32Socket tồn tại VÀ trạng thái của nó là OPEN
  if (esp32Socket && esp32Socket.readyState === WebSocket.OPEN) {
     try {
        console.log(`Gửi lệnh "${action}" tới ESP32 qua WebSocket...`);
        esp32Socket.send(action);

        await Log.create({
           user: req.user.id,
           action: action,
           source: 'APP'
         });

        res.status(200).json({ message: 'Đã gửi lệnh thành công.' });
     } catch (sendError) {
        console.error("Lỗi khi gửi WebSocket:", sendError);
        // Trả lỗi cụ thể hơn nếu có thể
        res.status(500).json({ message: `Lỗi server khi gửi lệnh WebSocket: ${sendError.message}` });
     }
  } else {
     // Log rõ hơn lý do không gửi được
     if (!esp32Socket) {
        console.warn("Không có kết nối ESP32 WebSocket.");
     } else {
        console.warn(`Kết nối ESP32 WebSocket không ở trạng thái OPEN (readyState: ${esp32Socket.readyState}).`);
     }
     res.status(400).json({ message: 'Thiết bị ESP32 không kết nối hoặc chưa sẵn sàng. Không thể gửi lệnh.' });
  }
  // --- Kết thúc gửi WebSocket ---
});

// === API Lịch Sử ===
// GET /api/logs
router.get('/logs', protect, async (req, res) => {
  try {
    const logs = await Log.find({ user: req.user.id }) // Chỉ lấy log của user đang đăng nhập
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('user', 'username'); // Lấy tên username từ collection User
    res.json(logs);
  } catch (error) {
     console.error("Lỗi khi lấy logs:", error);
    res.status(500).json({ message: `Lỗi server khi lấy lịch sử: ${error.message}` });
  }
});

// === API Hẹn Giờ ===
// POST /api/schedules
router.post('/schedules', protect, async (req, res) => {
 const { action, cronTime } = req.body;
 const scheduler = req.scheduler;

 // Thêm kiểm tra đầu vào cơ bản
 if (!action || !cronTime || !['OPEN', 'CLOSE', 'STOP'].includes(action)) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ. Vui lòng cung cấp action (OPEN, CLOSE, STOP) và cronTime.' });
 }
 // TODO: Validate cronTime format kỹ hơn nếu cần

 try {
   const newSchedule = new Schedule({
     user: req.user.id, // Lưu ID của user tạo lịch hẹn
     action,
     cronTime
   });
   await newSchedule.save();

   scheduler.addJob(newSchedule); // Thông báo cho scheduler về job mới

   res.status(201).json(newSchedule);
 } catch (error) {
    console.error("Lỗi khi thêm schedule:", error);
   // Trả lỗi cụ thể hơn nếu là lỗi validation
   if (error.name === 'ValidationError') {
       return res.status(400).json({ message: `Lỗi validation: ${error.message}` });
   }
   res.status(500).json({ message: `Lỗi server khi thêm lịch hẹn: ${error.message}` });
 }
});

// GET /api/schedules
router.get('/schedules', protect, async (req, res) => {
 try {
   const schedules = await Schedule.find({ user: req.user.id }); // Chỉ lấy lịch hẹn của user
   res.json(schedules);
 } catch (error) {
    console.error("Lỗi khi lấy schedules:", error);
   res.status(500).json({ message: `Lỗi server khi lấy danh sách lịch hẹn: ${error.message}` });
 }
});

// DELETE /api/schedules/:id
router.delete('/schedules/:id', protect, async (req, res) => {
 const scheduler = req.scheduler;
 const scheduleId = req.params.id;

 try {
   // Tìm và xóa, đảm bảo đúng user sở hữu
   const schedule = await Schedule.findOneAndDelete({
     _id: scheduleId,
     user: req.user.id
   });

   if (!schedule) {
     return res.status(404).json({ message: 'Không tìm thấy lịch hẹn hoặc bạn không có quyền xóa.' });
   }

   scheduler.removeJob(scheduleId); // Thông báo cho scheduler xóa job

   res.json({ message: 'Xóa lịch hẹn thành công.' });
 } catch (error) {
    console.error("Lỗi khi xóa schedule:", error);
    // Xử lý trường hợp ID không hợp lệ
    if (error.name === 'CastError') {
        return res.status(400).json({ message: 'ID lịch hẹn không hợp lệ.' });
    }
   res.status(500).json({ message: `Lỗi server khi xóa lịch hẹn: ${error.message}` });
 }
});

module.exports = router;

