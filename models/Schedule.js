const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['OPEN', 'CLOSE', 'STOP'],
    required: true
  },
  cronTime: {
    type: String, // Định dạng Cron, vd: "30 22 * * *" (22:30 hàng ngày)
    required: true
  },
  isEnabled: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('Schedule', ScheduleSchema);