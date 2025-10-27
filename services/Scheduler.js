const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const Log = require('../models/Log');

const MQTT_TOPIC_COMMAND = 'door/command'; // Topic để gửi lệnh

class Scheduler {
  constructor(mqttClient) { // Nhận MQTT client instance
    this.mqttClient = mqttClient; // Lưu mqttClient
    this.jobs = new Map();
  }

  async start() {
    console.log('Starting Scheduler...');
    try {
      // Populate thông tin user để ghi log username
      const schedules = await Schedule.find({ isEnabled: true }).populate('user', 'username');
      schedules.forEach(schedule => {
        if (schedule.user) {
           this.addJob(schedule);
        } else {
           console.warn(`Schedule ${schedule._id} missing user ref. Skipping.`);
        }
      });
      console.log(`Scheduler started. Loaded ${this.jobs.size} jobs.`);
    } catch (error) {
      console.error("Error loading schedules:", error);
    }
  }

  addJob(schedule) {
    const jobId = schedule._id.toString();
    if (this.jobs.has(jobId)) { return; }
    if (!cron.validate(schedule.cronTime)) {
      console.error(`Invalid cronTime ${schedule.cronTime} for job ${jobId}`);
      return;
    }
     if (!schedule.user || !schedule.user._id || !schedule.user.username) {
        console.error(`Cannot add job ${jobId}, user info missing.`);
        return;
    }

    try {
      const job = cron.schedule(schedule.cronTime, async () => {
        console.log(`Executing job ${jobId}: Action ${schedule.action}, Cron ${schedule.cronTime}`);

        // --- Gửi lệnh qua MQTT tới HiveMQ ---
        if (this.mqttClient && this.mqttClient.connected) {
            console.log(`Publishing scheduled command "${schedule.action}"...`);
            this.mqttClient.publish(MQTT_TOPIC_COMMAND, schedule.action, { qos: 1 }, async (err) => {
               if (err) {
                  console.error(`Error publishing scheduled MQTT command for job ${jobId}:`, err);
               } else {
                   console.log(`Scheduled command "${schedule.action}" published for job ${jobId}.`);
                   // Ghi log sau khi publish thành công
                   try {
                       await Log.create({
                           user: schedule.user._id,
                           action: schedule.action,
                           source: 'SCHEDULED'
                       });
                       console.log(`Logged scheduled action for job ${jobId}`);
                   } catch (logError) {
                       console.error(`Error logging scheduled action for job ${jobId}:`, logError);
                   }
               }
            });
        } else {
            console.warn(`Job ${jobId} did not execute: MQTT client not connected.`);
        }
        // --- Kết thúc gửi MQTT ---
      });

      this.jobs.set(jobId, job);
      console.log(`Scheduled job added: ${jobId} (${schedule.cronTime} for ${schedule.user.username})`);
    } catch (cronError) {
       console.error(`Error creating cron job for ${jobId}:`, cronError);
    }
  }

  removeJob(jobId) { // Giữ nguyên
    const job = this.jobs.get(jobId);
    if (job) {
      try { job.stop(); this.jobs.delete(jobId); console.log(`Scheduled job removed: ${jobId}`); }
      catch (stopError) { console.error(`Error stopping cron job ${jobId}:`, stopError); }
    } else { console.warn(`Job not found for removal: ${jobId}`); }
  }
}

module.exports = Scheduler;