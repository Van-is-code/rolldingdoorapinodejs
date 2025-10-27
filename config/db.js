const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Đã kết nối MongoDB...');
  } catch (err) {
    console.error(err.message);
    process.exit(1); // Thoát nếu lỗi
  }
};

module.exports = connectDB;