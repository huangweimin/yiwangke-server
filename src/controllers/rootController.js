const pool = require('../models/db');

// 获取所有词根列表
exports.getRoots = async (req, res) => {
  try {
    // 从单词中提取所有词根
    const [words] = await pool.query('SELECT word_id, word, roots FROM words WHERE roots != "[]"');
    
    const rootMap = {};
    
    words.forEach(w => {
      try {
        let roots = w.roots;
        if (typeof roots === 'string') {
          roots = JSON.parse(roots);
        }
        if (Array.isArray(roots)) {
          roots.forEach(root => {
            if (!rootMap[root]) {
              rootMap[root] = {
                root,
                count: 0,
                words: []
              };
            }
            rootMap[root].count++;
            if (rootMap[root].words.length < 5) {
              rootMap[root].words.push({ word: w.word, word_id: w.word_id });
            }
          });
        }
      } catch (e) {
        // 跳过解析失败的
      }
    });
    
    const roots = Object.values(rootMap).sort((a, b) => b.count - a.count);
    
    res.json(roots);
  } catch (err) {
    console.error('获取词根列表失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 获取词根详情
exports.getRootDetail = async (req, res) => {
  try {
    const { root } = req.params;
    
    if (!root) {
      return res.status(400).json({ error: '缺少词根' });
    }
    
    // 查找包含该词根的所有单词
    const [words] = await pool.query(
      'SELECT word_id, word, phonetic, definition, family, roots FROM words WHERE roots LIKE ?',
      [`%"${root}"%`]
    );
    
    // 词根记忆法映射
    const rootMemoryMap = {
      'bene': { meaning: '好', tip: 'bene 在拉丁语中表示"好"，如benefit利益，benevolent善良的' },
      'mal': { meaning: '坏', tip: 'mal 在拉丁语中表示"坏"，如malice恶意，malicious恶毒的' },
      'dict': { meaning: '说', tip: 'dict 在拉丁语中表示"说"，如predict预测，dictate口述' },
      'duct': { meaning: '引导', tip: 'duct 来自拉丁语"引导"，如conduct引导，deduce推演' },
      'port': { meaning: '拿/运', tip: 'port 在拉丁语中表示"拿/运"，如transport运输，export出口' },
      'ject': { meaning: '扔', tip: 'ject 来自拉丁语"扔"，如project投射，inject注射' },
      'spect': { meaning: '看', tip: 'spect 在拉丁语中表示"看"，如inspect检查，respect尊重' },
      ' scribe': { meaning: '写', tip: 'scribe 来自拉丁语"写"，如describe描写，prescribe开处方' },
      'vert': { meaning: '转', tip: 'vert 在拉丁语中表示"转"，如convert转换，reverse颠倒' },
      'rupt': { meaning: '断裂', tip: 'rupt 来自拉丁语"断裂"，如erupt爆发，interrupt打断' },
      'gress': { meaning: '走', tip: 'gress 在拉丁语中表示"走"，如progress进步，regress退步' },
      'tract': { meaning: '拉/抽', tip: 'tract 来自拉丁语"拉"，如extract提取，attract吸引' },
      'clud': { meaning: '关闭', tip: 'clud 在拉丁语中表示"关闭"，如exclude排除，include包含' },
      'mit': { meaning: '发送', tip: 'mit 来自拉丁语"发送"，如transmit传输，submit提交' },
      'pel': { meaning: '推', tip: 'pel 在拉丁语中表示"推"，如propel推进，repel击退' },
      'tend': { meaning: '伸展', tip: 'tend 来自拉丁语"伸展"，如extend扩展，pretend假装' },
      'tain': { meaning: '拿住', tip: 'tain 在拉丁语中表示"拿住"，如obtain获得，contain包含' },
      'force': { meaning: '力量', tip: 'force 来自拉丁语"力量"，如forceful有力，reinforce加强' },
      'voc': { meaning: '声音', tip: 'voc 在拉丁语中表示"声音"，如vocal声音的，advocate倡导' },
      'form': { meaning: '形式', tip: 'form 在拉丁语中表示"形式"，如transform改变，perform表演' }
    };
    
    const info = rootMemoryMap[root] || { 
      meaning: '待补充',
      tip: `词根 "${root}" 常见于托福词汇中，建议通过例词记忆`
    };
    
    res.json({
      root,
      meaning: info.meaning,
      tip: info.tip,
      wordCount: words.length,
      words: words.map(w => ({
        word_id: w.word_id,
        word: w.word,
        phonetic: w.phonetic,
        definition: w.definition
      }))
    });
  } catch (err) {
    console.error('获取词根详情失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};
