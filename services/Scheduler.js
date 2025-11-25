const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const Log = require('../models/Log');

const MQTT_TOPIC_COMMAND = 'door/command';

class Scheduler {
  constructor(mqttClient) {
    this.mqttClient = mqttClient; // Sử dụng HiveMQ Client
    this.jobs = new Map(); 
  }

  async start() {
    console.log('Starting Scheduler...');
    try {
      const schedules = await Schedule.find({ isEnabled: true }).populate('user', 'username');
      schedules.forEach(schedule => {
        if (schedule.user) {
           this.addJob(schedule);
        }
      });
      console.log(`Scheduler started. Loaded ${this.jobs.size} jobs.`);
    } catch (error) {
      console.error("Error loading schedules:", error);
    }
  }

  addJob(schedule) {
    const jobId = schedule._id.toString();
    if (this.jobs.has(jobId)) return;

    if (!cron.validate(schedule.cronTime)) {
      console.error(`Invalid cronTime ${schedule.cronTime}`);
      return;
    }

    try {
      // --- QUAN TRỌNG: Thêm múi giờ Việt Nam ---
      const job = cron.schedule(schedule.cronTime, async () => {
        console.log(`Executing job ${jobId}: ${schedule.action} at ${new Date().toLocaleString()}`);

        if (this.mqttClient && this.mqttClient.connected) {
            this.mqttClient.publish(MQTT_TOPIC_COMMAND, schedule.action, { qos: 1 }, async (err) => {
               if (!err) {
                   console.log(`Scheduled command "${schedule.action}" sent.`);
                   try {
                       await Log.create({
                           user: schedule.user._id,
                           action: schedule.action,
                           source: 'SCHEDULED'
                       });
                   } catch (e) { console.error("Log error:", e); }
               }
            });
        } else {
            console.warn("MQTT Client not connected. Cannot execute schedule.");
        }
      }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh" // <--- BẮT BUỘC PHẢI CÓ DÒNG NÀY
      });

      this.jobs.set(jobId, job);
      console.log(`Scheduled job added: ${jobId} (${schedule.cronTime} - Asia/Ho_Chi_Minh)`);
    } catch (cronError) {
       console.error(`Error creating cron job:`, cronError);
    }
  }

  removeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.stop();
      this.jobs.delete(jobId);
      console.log(`Scheduled job removed: ${jobId}`);
    }
  }
}

module.exports = Scheduler;