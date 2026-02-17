# HƯỚNG DẪN DEPLOYMENT

## Vấn Đề Đã Sửa

Khi deploy lên Kobey (hoặc các hosting platforms tương tự), dự án gặp lỗi **"Cannot find module 'express'"** vì:

1.  Package.json thiếu field `engines` - hosting platforms cần biết phiên bản Node.js và npm
2.  PORT bị hardcode thay vì sử dụng biến môi trường từ platform
3.  Thiếu file cấu hình deployment

## Các Thay Đổi Đã Thực Hiện

### 1. **package.json** 
- Thêm field `engines` để chỉ định phiên bản Node.js >= 18.0.0 và npm >= 9.0.0
- Thêm script `dev` để development

### 2. **server.js** 
- Thay đổi `const API_PORT = 3000` thành `const API_PORT = process.env.PORT || 3000`
- Bây giờ server sẽ sử dụng PORT từ environment variable của hosting platform

### 3. **Procfile**  (Mới)
- File cấu hình cho Heroku-based platforms như Kobey
- Chỉ định command để start ứng dụng: `web: node server.js`

### 4. **kobey.yml**  (Mới)
- File cấu hình chi tiết cho Kobey platform
- Chỉ định buildpack, install command, và start command

### 5. **.npmrc**  (Mới)
- Cấu hình npm để đảm bảo dependencies được cài đặt đúng cách
- Enable package-lock.json

## Các File Cần Push Lên Git

Đảm bảo các file sau được commit và push:

`
 package.json
 package-lock.json
 server.js
 Procfile
 kobey.yml
 .npmrc
 config/
 middleware/
 models/
 routes/
 services/
`

**KHÔNG push:**
-  node_modules/
-  .env

## Cách Deploy Lên Kobey

### Bước 1: Commit và Push Code

`ash
git add .
git commit -m "Fix deployment issues - Add engines, Procfile, and dynamic PORT"
git push origin main
`

### Bước 2: Deploy trên Kobey

1. Đăng nhập vào Kobey Dashboard
2. Chọn dự án hoặc tạo dự án mới
3. Kết nối với GitHub repository
4. Kobey sẽ tự động:
   - Phát hiện Node.js project
   - Chạy `npm install` (cài đặt dependencies)
   - Chạy `node server.js` (start server)

### Bước 3: Cấu Hình Environment Variables

Trên Kobey Dashboard, thêm các environment variables sau:

`
DATABASE_URL=postgresql://postgres:@Van0862215231@db.qzhxidaqvlxwdyungcyr.supabase.co:5432/postgres
HIVEMQ_CLUSTER_URL=c131d19cf9b3498ab5655988b219498f.s1.eu.hivemq.cloud
HIVEMQ_USERNAME=cbgbar
HIVEMQ_PASSWORD=@Van02092005
HIVEMQ_PORT=8883
JWT_SECRET=aGV0aG9uZ2N1YWN1b24=
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
NODE_ENV=production
`

**Lưu ý:** PORT sẽ tự động được set bởi platform, không cần cấu hình thủ công.

## Deploy Lên Các Platform Khác

### Heroku

`ash
heroku login
heroku create your-app-name
heroku config:set DATABASE_URL="your-database-url"
heroku config:set HIVEMQ_CLUSTER_URL="..."
# ... set các biến môi trường khác
git push heroku main
`

### Railway

1. Đăng nhập Railway
2. New Project > Deploy from GitHub
3. Chọn repository
4. Thêm environment variables trong Settings
5. Railway tự động deploy

### Render

1. Đăng nhập Render
2. New > Web Service
3. Connect repository
4. Thêm environment variables
5. Deploy

## Kiểm Tra Sau Khi Deploy

1. **Kiểm tra logs:**
   - Xem có message "Đã kết nối PostgreSQL..."
   - Xem có message ">>> Đã kết nối thành công tới HiveMQ Broker!"
   - Xem có message "API Server đang chạy trên port XXX"

2. **Test API:**
   `ash
   curl https://your-app-url.kobey.app/auth/login -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'
   `

3. **Kiểm tra Database:**
   - Vào Supabase Dashboard
   - Xem tables đã được tạo chưa (Users, Schedules, Logs)

## Troubleshooting

### Lỗi: "Cannot find module"
 **Đã sửa:** Thêm engines trong package.json và đảm bảo package-lock.json được commit

### Lỗi: "Application failed to respond"
- Kiểm tra xem server có đang listen trên `process.env.PORT` không
-  **Đã sửa:** Cập nhật server.js để sử dụng dynamic PORT

### Database connection failed
- Kiểm tra DATABASE_URL có đúng không
- Kiểm tra database có allow external connections không
- Kiểm tra SSL settings trong config/db.js

### MQTT connection failed
- Kiểm tra HIVEMQ credentials
- Kiểm tra firewall/network settings của hosting platform

## Cấu Trúc Dự Án

`
rolldingdoorapinodejs/
 config/
    db.js                 # PostgreSQL/Sequelize config
 middleware/
    auth.js               # JWT authentication
 models/
    User.js               # User model
    Schedule.js           # Schedule model
    Log.js                # Log model
 routes/
    auth.js               # Authentication routes
    api.js                # API routes
 services/
    Scheduler.js          # Cron job scheduler
 .env                      # Local environment variables (không push)
 .gitignore                # Git ignore rules
 .npmrc                    # NPM configuration
 kobey.yml                 # Kobey deployment config
 package.json              # Dependencies và scripts
 package-lock.json         # Locked dependencies versions
 Procfile                  # Process start command
 server.js                 # Main application file
`

## Contacts & Support

Nếu gặp vấn đề khi deploy:
1. Kiểm tra logs trên hosting platform
2. Verify tất cả environment variables đã được set
3. Đảm bảo database connection string đúng format
4. Test locally trước khi deploy: `npm start`

---

**Updated:** February 2026
**Platform Tested:** Kobey, Heroku, Railway, Render
