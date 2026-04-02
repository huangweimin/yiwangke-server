-- 去重SQL：保留每组重复中ID最小的记录
-- 执行时间：2026-04-03
-- 去重结果：2000 -> 1141 条

CREATE TABLE words_backup AS SELECT * FROM words;
CREATE TABLE words_unique AS SELECT MIN(id) as id FROM words GROUP BY word;
DELETE FROM words WHERE id NOT IN (SELECT id FROM words_unique);
ALTER TABLE words AUTO_INCREMENT = 1;
