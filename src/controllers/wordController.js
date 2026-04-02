const pool = require('../models/db');

// 获取单词列表（支持分页和分类）
exports.getWords = async (req, res) => {
  try {
    const userId = req.userId;
    const { root, search, category, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT w.*, 
        CASE 
          WHEN ulr.status = 'mastered' THEN 'mastered'
          WHEN ulr.status = 'learning' THEN 'learning'
          WHEN ulr.status = 'new' THEN 'new'
          ELSE 'not_learned'
        END as learn_status
      FROM words w
      LEFT JOIN user_learning_records ulr ON w.word_id = ulr.word_id AND ulr.user_id = ?
      WHERE 1=1
    `;
    const params = [userId];
    
    // 词根筛选
    if (root) {
      query += ' AND JSON_CONTAINS(w.roots, ?)';
      params.push(JSON.stringify(root));
    }
    
    // 搜索
    if (search) {
      query += ' AND (w.word LIKE ? OR w.definition LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // 分类（按首字母）
    if (category) {
      query += ' AND w.word LIKE ?';
      params.push(`${category}%`);
    }
    
    // 排序和分页
    query += ' ORDER BY w.word LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const [words] = await pool.query(query, params);
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM words w WHERE 1=1';
    const countParams = [];
    
    if (root) {
      countQuery += ' AND JSON_CONTAINS(w.roots, ?)';
      countParams.push(JSON.stringify(root));
    }
    if (search) {
      countQuery += ' AND (w.word LIKE ? OR w.definition LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      countQuery += ' AND w.word LIKE ?';
      countParams.push(`${category}%`);
    }
    
    const [countResult] = await pool.query(countQuery, countParams);
    
    // 获取首字母分类
    const [categories] = await pool.query(`
      SELECT DISTINCT UPPER(LEFT(word, 1)) as letter, COUNT(*) as count
      FROM words
      GROUP BY UPPER(LEFT(word, 1))
      ORDER BY letter
    `);
    
    res.json({
      words,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: offset + words.length < countResult[0].total,
      categories
    });
  } catch (err) {
    console.error('获取单词列表失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 获取单词详情
exports.getWord = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [words] = await pool.query('SELECT * FROM words WHERE word_id = ?', [id]);
    
    if (words.length === 0) {
      return res.status(404).json({ error: '单词不存在' });
    }
    
    const word = words[0];
    
    // 如果已登录，获取用户学习记录
    let userRecord = null;
    if (req.userId) {
      const [records] = await pool.query(
        'SELECT * FROM user_learning_records WHERE user_id = ? AND word_id = ?',
        [req.userId, id]
      );
      if (records.length > 0) {
        userRecord = records[0];
      }
    }
    
    res.json({
      ...word,
      family: word.family || [],
      examples: word.examples || [],
      roots: word.roots || [],
      userRecord
    });
  } catch (err) {
    console.error('获取单词详情失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 获取词根列表
exports.getRoots = async (req, res) => {
  try {
    const [roots] = await pool.query('SELECT * FROM roots ORDER BY root');
    res.json(roots);
  } catch (err) {
    console.error('获取词根列表失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};
