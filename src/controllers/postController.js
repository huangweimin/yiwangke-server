const pool = require('../models/db');

// 获取社区动态列表
exports.getPosts = async (req, res) => {
  try {
    const userId = req.userId;
    const { type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    if (type === 'checkin') {
      whereClause = 'AND p.post_type = "checkin"';
    } else if (type === 'note') {
      whereClause = 'AND p.post_type = "note"';
    }
    
    const [posts] = await pool.query(`
      SELECT p.*, u.nickname as username,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
        EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 1=1 ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), offset]);
    
    // 获取评论数
    for (let post of posts) {
      const [comments] = await pool.query(
        'SELECT COUNT(*) as count FROM post_comments WHERE post_id = ?',
        [post.id]
      );
      post.comment_count = comments[0].count;
    }
    
    res.json(posts);
  } catch (err) {
    console.error('获取动态失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 发布动态
exports.createPost = async (req, res) => {
  try {
    const userId = req.userId;
    const { content, postType, wordId } = req.body;
    
    if (!content || !postType) {
      return res.status(400).json({ error: '内容不能为空' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO posts (user_id, content, post_type, word_id) VALUES (?, ?, ?, ?)`,
      [userId, content, postType, wordId || null]
    );
    
    res.json({ 
      success: true, 
      postId: result.insertId,
      message: '发布成功' 
    });
  } catch (err) {
    console.error('发布失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 点赞/取消点赞
exports.toggleLike = async (req, res) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;
    
    // 检查是否已点赞
    const [existing] = await pool.query(
      'SELECT * FROM post_likes WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );
    
    if (existing.length > 0) {
      // 取消点赞
      await pool.query(
        'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
        [userId, postId]
      );
      res.json({ success: true, liked: false });
    } else {
      // 添加点赞
      await pool.query(
        'INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)',
        [userId, postId]
      );
      res.json({ success: true, liked: true });
    }
  } catch (err) {
    console.error('点赞失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 获取排行榜
exports.getLeaderboard = async (req, res) => {
  try {
    const { type = 'streak' } = req.query; // streak | words | checkin
    
    let orderBy = 'us.streak_days DESC';
    if (type === 'words') {
      orderBy = 'us.total_words DESC';
    } else if (type === 'checkin') {
      orderBy = 'checkins DESC';
    }
    
    const [users] = await pool.query(`
      SELECT u.id, u.nickname as username,
        COALESCE(us.streak_days, 0) as streak,
        COALESCE(us.total_words, 0) as wordsLearned,
        COALESCE(
          (SELECT COUNT(*) FROM daily_checkins WHERE user_id = u.id), 0
        ) as checkins
      FROM users u
      LEFT JOIN user_stats us ON u.id = us.user_id
      ORDER BY ${orderBy}
      LIMIT 50
    `);
    
    res.json(users);
  } catch (err) {
    console.error('获取排行榜失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 获取用户的学习笔记
exports.getUserNotes = async (req, res) => {
  try {
    const userId = req.params.userId || req.userId;
    
    const [notes] = await pool.query(`
      SELECT p.*, w.word, w.phonetic
      FROM posts p
      LEFT JOIN words w ON p.word_id = w.word_id
      WHERE p.user_id = ? AND p.post_type = 'note'
      ORDER BY p.created_at DESC
      LIMIT 50
    `, [userId]);
    
    res.json(notes);
  } catch (err) {
    console.error('获取笔记失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};
