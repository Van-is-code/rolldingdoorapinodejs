const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Log = require("../models/Log");
const Schedule = require("../models/Schedule");
const User = require("../models/User");

console.log("Initializing api router...");

const MQTT_TOPIC_COMMAND = "door/command";

// === API Gửi Lệnh ===
// POST /api/command
router.post("/command", protect, async (req, res) => {
  const { action } = req.body;
  const mqttClient = req.mqttClient;
  console.log(`Received command request: ${action} from user ${req.user.username}`);

  if (!["OPEN", "CLOSE", "STOP"].includes(action)) {
    console.warn(`Invalid action: ${action}`);
    return res.status(400).json({ message: "Lệnh không hợp lệ." });
  }

  if (mqttClient && mqttClient.connected) {
    try {
      console.log(`Publishing command "${action}" to topic ${MQTT_TOPIC_COMMAND}...`);
      mqttClient.publish(MQTT_TOPIC_COMMAND, action, { qos: 1 }, async (err) => {
        if (err) {
          console.error(`Error publishing MQTT command "${action}":`, err);
          if (!res.headersSent) {
            res.status(500).json({ message: `Lỗi khi gửi lệnh MQTT: ${err.message}` });
          }
        } else {
          console.log(`Command "${action}" published successfully.`);
          try {
            await Log.create({
              userId: req.user.id,
              action: action,
              source: "APP",
            });
            console.log(`Logged command action: ${action} for user ${req.user.username}`);
            if (!res.headersSent) {
              res.status(200).json({ message: "Đã gửi lệnh thành công." });
            }
          } catch (logError) {
            console.error("Error logging command after successful publish:", logError);
            if (!res.headersSent) {
              res.status(500).json({ message: "Lệnh đã được gửi nhưng ghi log thất bại." });
            }
          }
        }
      });
    } catch (error) {
      console.error("Error preparing MQTT publish:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: `Lỗi server khi chuẩn bị gửi lệnh: ${error.message}` });
      }
    }
  } else {
    const reason = !mqttClient ? "MQTT client chưa khởi tạo." : "MQTT client không kết nối.";
    console.warn(`Cannot send command "${action}": ${reason}`);
    res.status(500).json({ message: `Không thể gửi lệnh: ${reason}` });
  }
});

// === API Lịch Sử ===
router.get("/logs", protect, async (req, res) => {
  console.log(`Received GET /api/logs request from user ${req.user.username}`);
  try {
    const logs = await Log.findAll({
      where: { userId: req.user.id },
      order: [["timestamp", "DESC"]],
      limit: 50,
      include: [
        {
          model: User,
          attributes: ["username"],
        },
      ],
    });
    res.json(logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ message: `Lỗi server khi lấy lịch sử: ${error.message}` });
  }
});

// === API Hẹn Giờ ===
router.post("/schedules", protect, async (req, res) => {
  const { action, cronTime } = req.body;
  const scheduler = req.scheduler;
  console.log(`Received POST /api/schedules request: ${action} ${cronTime} from user ${req.user.username}`);

  if (!action || !cronTime || !["OPEN", "CLOSE", "STOP"].includes(action)) {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ." });
  }
  if (cronTime.split(" ").length !== 5) {
    return res.status(400).json({ message: "Định dạng cronTime không hợp lệ." });
  }

  try {
    const newSchedule = await Schedule.create({
      userId: req.user.id,
      action,
      cronTime,
    });
    scheduler.addJob(newSchedule);
    console.log(`Schedule added: ${newSchedule.id} for user ${req.user.username}`);
    res.status(201).json(newSchedule);
  } catch (error) {
    console.error("Error creating schedule:", error);
    res.status(500).json({ message: `Lỗi server khi tạo lịch: ${error.message}` });
  }
});

router.get("/schedules", protect, async (req, res) => {
  console.log(`Received GET /api/schedules request from user ${req.user.username}`);
  try {
    const schedules = await Schedule.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: User,
          attributes: ["username"],
        },
      ],
    });
    res.json(schedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({ message: `Lỗi server khi lấy lịch: ${error.message}` });
  }
});

router.delete("/schedules/:id", protect, async (req, res) => {
  const scheduler = req.scheduler;
  const scheduleId = req.params.id;
  console.log(`Received DELETE /api/schedules/${scheduleId} request from user ${req.user.username}`);

  try {
    const schedule = await Schedule.findByPk(scheduleId);
    if (!schedule) {
      return res.status(404).json({ message: "Lịch không tồn tại." });
    }
    if (schedule.userId !== req.user.id) {
      return res.status(403).json({ message: "Bạn không có quyền xóa lịch này." });
    }
    scheduler.removeJob(scheduleId);
    await schedule.destroy();
    console.log(`Schedule deleted: ${scheduleId}`);
    res.json({ message: "Xóa lịch thành công." });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    res.status(500).json({ message: `Lỗi server khi xóa lịch: ${error.message}` });
  }
});

console.log("API router configuration complete.");
module.exports = router;
