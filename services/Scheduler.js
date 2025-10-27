const cron = require('node-cron');
const WebSocket = require('ws'); // Import WebSocket để kiểm tra state
const Schedule = require('../models/Schedule');
const Log = require('../models/Log');

class Scheduler {
  constructor(wss) { // Nhận WebSocket Server instance
    this.wss = wss;     // Lưu wss
    this.jobs = new Map(); // Lưu các job đang chạy
  }

  async start() {
    console.log('Starting Scheduler...');
    try {
      // Populate thông tin user để ghi log username
      const schedules = await Schedule.find({ isEnabled: true }).populate('user', 'username');
      schedules.forEach(schedule => {
        // Kiểm tra xem schedule.user có tồn tại không trước khi addJob
        if (schedule.user) {
           this.addJob(schedule);
        } else {
           console.warn(`Schedule ${schedule._id} is missing user reference. Skipping job creation.`);
        }
      });
      console.log(`Scheduler started. Loaded and scheduled ${this.jobs.size} jobs.`);
    } catch (error) {
      console.error("Error loading schedules from DB:", error);
    }
  }

  addJob(schedule) {
    const jobId = schedule._id.toString();
    if (this.jobs.has(jobId)) {
      console.warn(`Job ${jobId} already exists. Skipping.`);
      return;
    }
    if (!cron.validate(schedule.cronTime)) {
      console.error(`Invalid cronTime for schedule ${jobId}: ${schedule.cronTime}`);
      return;
    }
    if (!schedule.user || !schedule.user._id || !schedule.user.username) {
        console.error(`Cannot add job ${jobId}, user information is missing or incomplete.`);
        return;
    }

    try {
      const job = cron.schedule(schedule.cronTime, async () => {
        console.log(`Executing job ${jobId}: Action ${schedule.action}, Cron ${schedule.cronTime}`);

        let commandSentToAnyClient = false;
        let connectedClientsCount = 0;

        // --- Gửi lệnh qua WebSocket cho TẤT CẢ client đang kết nối ---
        this.wss.clients.forEach((client) => {
          connectedClientsCount++;
          // Giả định mọi client kết nối là ESP32
          if (client.readyState === WebSocket.OPEN) {
            try {
              console.log(`Sending scheduled command "${schedule.action}" to client...`);
              client.send(schedule.action, (err) => {
                 if (err) {
                    console.error(`Error sending scheduled command to a client:`, err);
                 } else {
                    console.log(`Scheduled command "${schedule.action}" sent to a client.`);
                    commandSentToAnyClient = true;
                    // Ghi log ngay sau khi gửi thành công
                     Log.create({
                        user: schedule.user._id,
                        action: schedule.action,
                        source: 'SCHEDULED'
                      }).then(() => {
                         console.log(`Logged scheduled action ${schedule.action} for job ${jobId}, user ${schedule.user.username}`);
                      }).catch(logError => {
                         console.error(`Error logging scheduled action for job ${jobId}:`, logError);
                      });
                 }
              });
            } catch (sendError) {
               console.error(`Immediate error sending scheduled WebSocket command: ${sendError}`);
            }
          } else {
             console.warn(`Skipping client with readyState: ${client.readyState} for scheduled command.`);
          }
        });
        // --- Kết thúc gửi WebSocket ---

        if (!commandSentToAnyClient) {
            if (connectedClientsCount === 0) {
               console.warn(`Job ${jobId} did not execute: No WebSocket clients connected.`);
            } else {
               console.warn(`Job ${jobId} did not execute: No OPEN WebSocket clients found (Total connected: ${connectedClientsCount}).`);
            }
        }
      });

      this.jobs.set(jobId, job);
      console.log(`Scheduled job added: ${jobId} (${schedule.cronTime} for user ${schedule.user.username})`);
    } catch (cronError) {
       console.error(`Error creating cron job for ${jobId}:`, cronError);
    }
  }

  removeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      try {
        job.stop();
        this.jobs.delete(jobId);
        console.log(`Scheduled job removed: ${jobId}`);
      } catch (stopError) {
         console.error(`Error stopping cron job ${jobId}:`, stopError);
      }
    } else {
       console.warn(`Job not found for removal: ${jobId}`);
    }
  }
}

module.exports = Scheduler;