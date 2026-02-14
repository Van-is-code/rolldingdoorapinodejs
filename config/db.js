const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/rolldingdoor", {
  dialect: "postgres",
  logging: false, // Set to console.log để xem SQL queries
  dialectOptions: {
    ssl: process.env.NODE_ENV === "production" ? { require: true, rejectUnauthorized: false } : false,
  },
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("Đã kết nối PostgreSQL...");
    
    // Sync models (tạo bảng nếu chưa tồn tại)
    await sequelize.sync({ alter: false });
    console.log("Database synchronized.");
  } catch (err) {
    console.error("Lỗi kết nối PostgreSQL:", err.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
