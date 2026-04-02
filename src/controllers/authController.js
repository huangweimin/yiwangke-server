const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../models/db');
require('dotenv').config();

exports.register = async (req, res) => {
  try {
    const { nickname, email, password } = req.body;
    
    if (!nickname || !email || !password) {
      return res.status(400).json({ error: '请填写完整信息' });
    }
    
    // 检查邮箱是否已注册
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: '该邮箱已注册' });
    }
    
    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);
    
    // 创建用户
    const [result] = await pool.query(
      'INSERT INTO users (nickname, email, password_hash) VALUES (?, ?, ?)',
      [nickname, email, passwordHash]
    );
    
    const userId = result.insertId;
    
    // 初始化用户统计
    await pool.query('INSERT INTO user_stats (user_id) VALUES (?)', [userId]);
    
    // 生成 Token
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
    
    res.json({
      token,
      user: { id: userId, nickname, email }
    });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '请填写邮箱和密码' });
    }
    
    // 查找用户
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    
    const user = users[0];
    
    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    
    // 生成 Token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
    
    res.json({
      token,
      user: { id: user.id, nickname: user.nickname, email: user.email }
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, nickname, email, daily_goal, reminder_time, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(users[0]);
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};
