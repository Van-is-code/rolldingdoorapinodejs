const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { protect, isAdmin } = require('../middleware/auth');

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Sai tên đăng nhập hoặc mật khẩu.' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Sai tên đăng nhập hoặc mật khẩu.' });
    }
    const token = jwt.sign({ id: user._id, role: user.role, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: '30d' // Token hết hạn sau 30 ngày
    });
    res.json({ token, username: user.username, role: user.role });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

// POST /auth/admin/create-user (Chỉ Admin được tạo)
router.post('/admin/create-user', protect, isAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập đủ tên và mật khẩu.' });
  }
  try {
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại.' });
    }
    const user = new User({
      username,
      password,
      role: role || 'user'
    });
    await user.save();
    res.status(201).json({ message: 'Tạo người dùng thành công.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

// POST /auth/change-password (User tự đổi)
router.post('/change-password', protect, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.id);
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu cũ không đúng.' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Đổi mật khẩu thành công.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server.' });
  }
});

module.exports = router;