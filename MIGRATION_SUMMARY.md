# Tóm Tắt Chuyển Đổi MongoDB sang PostgreSQL

## Những thay đổi đã được thực hiện:

### 1. **Package.json**
- Thay thế `mongoose` (^8.0.3) bằng `sequelize` (^6.35.2)
- Thêm `pg` (^8.11.3) - PostgreSQL driver cho Node.js
- Thêm `pg-hstore` (^2.3.4) - Helper cho Sequelize

### 2. **config/db.js**
- Thay đổi từ Mongoose connection sang Sequelize ORM
- Sử dụng PostgreSQL dialect
- Cấu hình connection pool
- Tự động sync models khi khởi động

### 3. **models/User.js**
- Chuyển đổi sang Sequelize Model
- Giữ lại password hashing với bcryptjs qua hooks
- Giữ method `comparePassword()` để kiểm tra password đăng nhập

### 4. **models/Schedule.js**
- Chuyển đổi sang Sequelize Model
- Tạo foreign key `userId` thay vì MongoDB ObjectId reference
- Giữ lại ENUM cho action field

### 5. **models/Log.js**
- Chuyển đổi sang Sequelize Model
- Tạo foreign key `userId` thay vì MongoDB ObjectId reference
- Tự động set timestamp mặc định

### 6. **middleware/auth.js**
- Thay `User.findById()` bằng `User.findByPk()` (Sequelize syntax)
- Sử dụng `{ where: {...} }` cho Sequelize queries

### 7. **routes/auth.js**
- Thay `User.findOne()` bằng `User.findOne({ where: {...} })`
- Thay `new User()` + `save()` bằng `User.create()`
- Cập nhật tất cả MongoDB queries

### 8. **routes/api.js**
- Thay `Log.find()` bằng `Log.findAll()`
- Sử dụng `.include()` thay cho `.populate()`
- Sử dụng `.order()` cho sorting
- Cập nhật `.destroy()` cho xóa records

### 9. **services/Scheduler.js**
- Thay `Schedule.find()` bằng `Schedule.findAll()`
- Cập nhật association reference từ `schedule.user` sang `schedule.User`
- Thay `schedule._id` bằng `schedule.id` (integer ID của Sequelize)

### 10. **server.js**
- Import từ `./config/db` thay vì gọi trực tiếp connectDB
- Cập nhật `User.findOne()` với Sequelize syntax
- Thay `new User()` + `save()` bằng `User.create()`

### 11. **.env**
- Thay `MONGO_URI` bằng PostgreSQL configuration:
  - DB_HOST = localhost
  - DB_PORT = 5432
  - DB_NAME = rolldingdoor
  - DB_USER = postgres
  - DB_PASSWORD = password

## Hướng dẫn cài đặt:

1. **Cài đặt PostgreSQL** (nếu chưa có)
   - Download từ https://www.postgresql.org/download/
   - Tạo database mới: `rolldingdoor`

2. **Cài đặt dependencies**
   ```
   npm install
   ```

3. **Cập nhật .env file**
   - Thay đổi DB_HOST, DB_USER, DB_PASSWORD phù hợp với cài đặt PostgreSQL của bạn
   - Cập nhật JWT_SECRET và ADMIN_PASSWORD

4. **Khởi động server**
   ```
   npm start
   ```

## Lưu ý quan trọng:

- Sequelize sẽ tự động tạo bảng khi server khởi động
- IDs bây giờ là integer (không phải ObjectId)
- ENUM fields được hỗ trợ trực tiếp bởi PostgreSQL
- Tất cả query methods đều tuân theo Sequelize conventions
- Relationship giữa bảng được quản lý bằng foreign keys
