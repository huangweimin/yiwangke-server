const pool = require('../models/db');

// 获取用户的打卡挑战列表
exports.getChallenges = async (req, res) => {
  try {
    const userId = req.userId
    
    // 获取用户的挑战
    const [challenges] = await pool.query(
      `SELECT * FROM challenges WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    )
    
    // 定义挑战模板
    const challengeTemplates = {
      newbie: {
        id: 'newbie',
        name: '新手挑战',
        icon: '🌱',
        description: '连续学习7天',
        totalDays: 7,
        type: 'newbie'
      },
      advanced: {
        id: 'advanced', 
        name: '进阶挑战',
        icon: '🔥',
        description: '连续学习30天',
        totalDays: 30,
        type: 'advanced'
      },
      master: {
        id: 'master',
        name: '大师挑战', 
        icon: '🏆',
        description: '连续学习100天',
        totalDays: 100,
        type: 'master'
      }
    }
    
    // 合并模板和用户数据
    const result = Object.values(challengeTemplates).map(template => {
      const userChallenge = challenges.find(c => c.challenge_type === template.type)
      if (userChallenge) {
        return {
          ...template,
          days: userChallenge.checkin_days,
          status: userChallenge.status,
          completedAt: userChallenge.completed_at
        }
      }
      return {
        ...template,
        days: 0,
        status: 'not_started'
      }
    })
    
    res.json(result)
  } catch (err) {
    console.error('获取挑战失败:', err)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 打卡
exports.checkin = async (req, res) => {
  try {
    const userId = req.userId
    const { challengeType } = req.body
    
    if (!challengeType || !['newbie', 'advanced', 'master'].includes(challengeType)) {
      return res.status(400).json({ error: '无效的挑战类型' })
    }
    
    // 检查今天是否已打卡
    const [todayCheckins] = await pool.query(
      `SELECT * FROM daily_checkins WHERE user_id = ? AND checkin_date = CURDATE()`,
      [userId]
    )
    
    if (todayCheckins.length > 0) {
      return res.status(400).json({ error: '今天已打卡' })
    }
    
    // 插入打卡记录
    await pool.query(
      `INSERT INTO daily_checkins (user_id, challenge_type, checkin_date) VALUES (?, ?, CURDATE())`,
      [userId, challengeType]
    )
    
    // 更新或创建挑战记录
    const [existing] = await pool.query(
      `SELECT * FROM challenges WHERE user_id = ? AND challenge_type = ?`,
      [userId, challengeType]
    )
    
    if (existing.length === 0) {
      // 创建新挑战
      await pool.query(
        `INSERT INTO challenges (user_id, challenge_type, checkin_days, status) VALUES (?, ?, 1, 'active')`,
        [userId, challengeType]
      )
    } else {
      // 更新挑战天数
      const currentDays = existing[0].checkin_days
      const newDays = currentDays + 1
      
      // 检查是否完成
      const totalDays = { newbie: 7, advanced: 30, master: 100 }[challengeType]
      const newStatus = newDays >= totalDays ? 'completed' : 'active'
      
      await pool.query(
        `UPDATE challenges SET checkin_days = ?, status = ?, completed_at = ? WHERE user_id = ? AND challenge_type = ?`,
        [newDays, newStatus, newStatus === 'completed' ? new Date() : null, userId, challengeType]
      )
    }
    
    res.json({ success: true, message: '打卡成功' })
  } catch (err) {
    console.error('打卡失败:', err)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 获取今日打卡状态
exports.getTodayStatus = async (req, res) => {
  try {
    const userId = req.userId
    
    const [todayCheckins] = await pool.query(
      `SELECT * FROM daily_checkins WHERE user_id = ? AND checkin_date = CURDATE()`,
      [userId]
    )
    
    const [yesterdayCheckins] = await pool.query(
      `SELECT * FROM daily_checkins WHERE user_id = ? AND checkin_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
      [userId]
    )
    
    // 获取各挑战的连续天数
    const [challenges] = await pool.query(
      `SELECT challenge_type, checkin_days, status FROM challenges WHERE user_id = ?`,
      [userId]
    )
    
    const challengeMap = {}
    challenges.forEach(c => {
      challengeMap[c.challenge_type] = {
        days: c.checkin_days,
        status: c.status
      }
    })
    
    res.json({
      checkedIn: todayCheckins.length > 0,
      canCheckIn: yesterdayCheckins.length > 0 || todayCheckins.length > 0,
      challenges: challengeMap
    })
  } catch (err) {
    console.error('获取状态失败:', err)
    res.status(500).json({ error: '服务器错误' })
  }
}

// 获取打卡记录列表
exports.getCheckinRecords = async (req, res) => {
  try {
    const userId = req.userId
    const { year, month } = req.query
    
    let query = `SELECT * FROM daily_checkins WHERE user_id = ?`
    const params = [userId]
    
    if (year && month) {
      query += ` AND YEAR(checkin_date) = ? AND MONTH(checkin_date) = ?`
      params.push(parseInt(year), parseInt(month))
    }
    
    query += ` ORDER BY checkin_date DESC LIMIT 50`
    
    const [records] = await pool.query(query, params)
    
    res.json(records)
  } catch (err) {
    console.error('获取记录失败:', err)
    res.status(500).json({ error: '服务器错误' })
  }
}
