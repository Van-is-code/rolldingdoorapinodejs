const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String,
    enum: ['OPEN', 'CLOSE', 'STOP'],
    required: true
  },
  source: {
    type: String,
    enum: ['APP', 'SCHEDULED'], // Nguồn gửi lệnh
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Log', LogSchema);