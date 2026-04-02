const pool = require('../models/db');

// 获取动态的评论列表
exports.getComments = async (req, res) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;
    
    const [comments] = await pool.query(`
      SELECT c.*, u.nickname as username,
        EXISTS(SELECT 1 FROM post_comments WHERE id = c.id AND user_id = ?) as is_mine
      FROM post_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `, [userId, postId]);
    
    res.json(comments);
  } catch (err) {
    console.error('获取评论失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 添加评论
exports.addComment = async (req, res) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }
    
    const [result] = await pool.query(
      'INSERT INTO post_comments (user_id, post_id, content) VALUES (?, ?, ?)',
      [userId, postId, content.trim()]
    );
    
    // 获取刚插入的评论
    const [comments] = await pool.query(`
      SELECT c.*, u.nickname as username
      FROM post_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.insertId]);
    
    res.json({ 
      success: true, 
      comment: comments[0],
      message: '评论成功' 
    });
  } catch (err) {
    console.error('添加评论失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 删除评论
exports.deleteComment = async (req, res) => {
  try {
    const userId = req.userId;
    const { commentId } = req.params;
    
    // 检查是否是评论所有者
    const [comments] = await pool.query(
      'SELECT * FROM post_comments WHERE id = ? AND user_id = ?',
      [commentId, userId]
    );
    
    if (comments.length === 0) {
      return res.status(403).json({ error: '无权限删除此评论' });
    }
    
    await pool.query('DELETE FROM post_comments WHERE id = ?', [commentId]);
    
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('删除评论失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};
