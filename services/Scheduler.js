const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const Log = require('../models/Log');

const MQTT_TOPIC_COMMAND = 'door/command';

class Scheduler {
  constructor(aedes) {
    this.aedes = aedes; // MQTT Broker
    this.jobs = new Map(); // Lưu các job đang chạy
  }

  // Khởi động: Tải tất cả lịch hẹn từ DB và chạy
  async start() {
    console.log('Khởi động Scheduler...');
    const schedules = await Schedule.find({ isEnabled: true });
    schedules.forEach(schedule => {
      this.addJob(schedule);
    });
    console.log(`Đã tải và chạy ${this.jobs.size} lịch hẹn.`);
  }

  // Thêm 1 job
  addJob(schedule) {
    const jobId = schedule._id.toString();
    
    // Kiểm tra nếu job đã tồn tại thì không thêm nữa
    if (this.jobs.has(jobId)) {
      return;
    }

    // Kiểm tra cronTime có hợp lệ không
    if (!cron.validate(schedule.cronTime)) {
      console.error(`Lịch hẹn ${jobId} có cronTime không hợp lệ: ${schedule.cronTime}`);
      return;
    }

    // Tạo 1 job mới
    const job = cron.schedule(schedule.cronTime, async () => {
      console.log(`THỰC THI LỊCH HẸN ${jobId}: Gửi lệnh ${schedule.action}`);
      
      // 1. Gửi lệnh qua MQTT
      this.aedes.publish({
        topic: MQTT_TOPIC_COMMAND,
        payload: schedule.action,
        qos: 1,
        retain: false
      });

      // 2. Ghi log
      await Log.create({
        user: schedule.user,
        action: schedule.action,
        source: 'SCHEDULED'
      });
    });

    // Lưu job vào Map để quản lý
    this.jobs.set(jobId, job);
    console.log(`Đã thêm lịch hẹn ${jobId} (${schedule.cronTime})`);
  }

  // Xóa 1 job
  removeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.stop(); // Dừng job
      this.jobs.delete(jobId); // Xóa khỏi Map
      console.log(`Đã xóa lịch hẹn ${jobId}`);
    }
  }
}

module.exports = Scheduler;