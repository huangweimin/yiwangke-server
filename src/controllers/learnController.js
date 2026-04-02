const pool = require('../models/db');

// SM-2 算法实现
function sm2(quality, easeFactor, interval, repetitions) {
  // quality: 0-忘记 1-模糊 2-记住
  let newEF = easeFactor;
  let newInterval = interval;
  let newReps = repetitions;
  
  if (quality < 1) {
    // 忘记：重新开始
    newReps = 0;
    newInterval = 1;
  } else {
    if (newReps === 0) {
      newInterval = 1;
    } else if (newReps === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    
    if (quality === 1) {
      // 模糊：降低难度
      newEF = Math.max(1.3, easeFactor - 0.14);
      newInterval = Math.max(1, Math.floor(interval * 0.8));
    } else {
      // 记住：增加难度因子
      newEF = easeFactor + (0.1 - (2 - quality) * (0.08 + (2 - quality) * 0.02));
    }
    
    newReps++;
  }
  
  return {
    easeFactor: Math.round(newEF * 100) / 100,
    interval: newInterval,
    repetitions: newReps
  };
}

// 获取今日任务
exports.getTodayTask = async (req, res) => {
  try {
    const userId = req.userId;
    const today = new Date().toISOString().split('T')[0];
    
    // 获取用户统计
    const [stats] = await pool.query(
      'SELECT * FROM user_stats WHERE user_id = ?',
      [userId]
    );
    
    const userStats = stats[0] || { streak_days: 0, today_learned: 0, today_reviewed: 0 };
    
    // 检查是否需要重置今日计数（新的一天）
    let isNewDay = false;
    if (userStats.last_study_date !== today) {
      isNewDay = true;
    }
    
    // 获取需要复习的单词
    const [dueReviews] = await pool.query(`
      SELECT w.*, ulr.ease_factor, ulr.interval_days, ulr.repetitions, ulr.review_count
      FROM words w
      JOIN user_learning_records ulr ON w.word_id = ulr.word_id
      WHERE ulr.user_id = ?
        AND ulr.next_review <= NOW()
        AND ulr.status != 'mastered'
      ORDER BY ulr.next_review ASC
      LIMIT 50
    `, [userId]);
    
    // 获取未学习的新词
    const [newWords] = await pool.query(`
      SELECT w.* FROM words w
      WHERE w.word_id NOT IN (
        SELECT word_id FROM user_learning_records WHERE user_id = ?
      )
      ORDER BY RAND()
      LIMIT 20
    `, [userId]);
    
    const dailyGoal = 20;
    let todayLearned = isNewDay ? 0 : userStats.today_learned;
    let todayReviewed = isNewDay ? 0 : userStats.today_reviewed;
    
    res.json({
      reviewCount: dueReviews.length,
      newCount: Math.min(5, Math.max(0, dailyGoal - dueReviews.length)),
      totalWords: dueReviews.length + newWords.length,
      streakDays: userStats.streak_days,
      todayLearned,
      todayReviewed,
      isNewDay,
      reviews: dueReviews.map(w => ({
        word_id: w.word_id,
        word: w.word,
        phonetic: w.phonetic,
        definition: w.definition,
        family: w.family || [],
        roots: w.roots || [],
        easeFactor: w.ease_factor,
        intervalDays: w.interval_days
      })),
      newWords: newWords.map(w => ({
        word_id: w.word_id,
        word: w.word,
        phonetic: w.phonetic,
        definition: w.definition,
        family: w.family || [],
        roots: w.roots || []
      }))
    });
  } catch (err) {
    console.error('获取今日任务失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 提交复习评分
exports.submitReview = async (req, res) => {
  try {
    const userId = req.userId;
    const { wordId, quality } = req.body; // quality: 0-忘记 1-模糊 2-记住
    
    if (!wordId || quality === undefined) {
      return res.status(400).json({ error: '参数不完整' });
    }
    
    // 获取当前记录
    const [records] = await pool.query(
      'SELECT * FROM user_learning_records WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );
    
    let easeFactor = 2.5;
    let intervalDays = 0;
    let repetitions = 0;
    
    if (records.length > 0) {
      easeFactor = Number(records[0].ease_factor) || 2.5;
      intervalDays = Number(records[0].interval_days) || 0;
      repetitions = Number(records[0].repetitions) || 0;
    }
    
    // SM-2 计算
    const result = sm2(quality, easeFactor, intervalDays, repetitions);
    
    // 计算下次复习时间
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + result.interval);
    
    // 判断状态
    let status = 'learning';
    if (result.repetitions >= 4 && result.interval >= 21) {
      status = 'mastered';
    }
    
    // 保存记录
    await pool.query(`
      INSERT INTO user_learning_records (user_id, word_id, ease_factor, interval_days, repetitions, next_review, status, review_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ease_factor = VALUES(ease_factor),
        interval_days = VALUES(interval_days),
        repetitions = VALUES(repetitions),
        next_review = VALUES(next_review),
        status = VALUES(status),
        review_count = review_count + 1
    `, [userId, wordId, result.easeFactor, result.interval, result.repetitions, nextReview, status, repetitions + 1]);
    
    // 更新统计
    await pool.query(`
      UPDATE user_stats SET
        today_reviewed = today_reviewed + 1,
        mastered_words = (SELECT COUNT(*) FROM user_learning_records WHERE user_id = ? AND status = 'mastered')
      WHERE user_id = ?
    `, [userId, userId]);
    
    res.json({
      success: true,
      status,
      interval: result.interval,
      nextReview: nextReview.toISOString()
    });
  } catch (err) {
    console.error('提交复习失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 学习新词
exports.learnNewWord = async (req, res) => {
  try {
    const userId = req.userId;
    const { wordId } = req.body;
    
    if (!wordId) {
      return res.status(400).json({ error: '缺少单词ID' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // 检查是否已学习过
    const [existing] = await pool.query(
      'SELECT * FROM user_learning_records WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: '该词已学习过' });
    }
    
    // 创建新词记录
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 1);
    
    await pool.query(`
      INSERT INTO user_learning_records (user_id, word_id, ease_factor, interval_days, repetitions, next_review, status, review_count)
      VALUES (?, ?, 2.5, 1, 1, ?, 'learning', 1)
    `, [userId, wordId, nextReview]);
    
    // 更新统计
    await pool.query(`
      UPDATE user_stats SET
        today_learned = today_learned + 1,
        last_study_date = ?
      WHERE user_id = ?
    `, [today, userId]);
    
    // 更新连续学习天数
    await updateStreak(userId);
    
    res.json({
      success: true,
      nextReview: nextReview.toISOString()
    });
  } catch (err) {
    console.error('学习新词失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 更新连续学习天数
async function updateStreak(userId) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const [stats] = await pool.query(
    'SELECT * FROM user_stats WHERE user_id = ?',
    [userId]
  );
  
  if (stats.length === 0) return;
  
  const lastDate = stats[0].last_study_date;
  const streakDays = stats[0].streak_days;
  
  if (lastDate === todayStr) return; // 今天已更新
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  let newStreak = 1;
  if (lastDate === yesterdayStr) {
    newStreak = streakDays + 1;
  }
  
  await pool.query(`
    UPDATE user_stats SET streak_days = ?, last_study_date = ? WHERE user_id = ?
  `, [newStreak, todayStr, userId]);
}

// 获取用户统计
exports.getStats = async (req, res) => {
  try {
    const userId = req.userId;
    
    const [stats] = await pool.query(
      'SELECT * FROM user_stats WHERE user_id = ?',
      [userId]
    );
    
    const [totalWords] = await pool.query('SELECT COUNT(*) as count FROM words');
    
    if (stats.length === 0) {
      return res.json({
        totalWords: totalWords[0].count,
        masteredWords: 0,
        todayLearned: 0,
        todayReviewed: 0,
        streakDays: 0
      });
    }
    
    res.json({
      totalWords: totalWords[0].count,
      masteredWords: stats[0].mastered_words,
      todayLearned: stats[0].today_learned,
      todayReviewed: stats[0].today_reviewed,
      streakDays: stats[0].streak_days,
      lastStudyDate: stats[0].last_study_date
    });
  } catch (err) {
    console.error('获取统计失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};
