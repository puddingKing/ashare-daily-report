const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_snapshots (
        id SERIAL PRIMARY KEY,
        trade_date DATE NOT NULL UNIQUE,
        market_data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        trade_date DATE NOT NULL UNIQUE,
        title TEXT NOT NULL,
        summary TEXT,
        content TEXT NOT NULL,
        market_snapshot_id INTEGER REFERENCES market_snapshots(id),
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_reports_trade_date ON reports(trade_date DESC);
    `);
    console.log('[db] PostgreSQL 初始化完成');
  } finally {
    client.release();
  }
}

function getTodayDate() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

async function saveMarketSnapshot(tradeDate, marketData) {
  const result = await pool.query(`
    INSERT INTO market_snapshots (trade_date, market_data)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (trade_date) DO UPDATE SET
      market_data = EXCLUDED.market_data,
      created_at = NOW()
    RETURNING id
  `, [tradeDate, JSON.stringify(marketData)]);
  return result.rows[0].id;
}

async function saveReport({ tradeDate, title, summary, content, marketSnapshotId, status = 'completed' }) {
  await pool.query(`
    INSERT INTO reports (trade_date, title, summary, content, market_snapshot_id, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (trade_date) DO UPDATE SET
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      content = EXCLUDED.content,
      market_snapshot_id = EXCLUDED.market_snapshot_id,
      status = EXCLUDED.status,
      created_at = NOW()
  `, [tradeDate, title, summary, content, marketSnapshotId, status]);
}

async function hasReportForDate(tradeDate) {
  const result = await pool.query(
    'SELECT id FROM reports WHERE trade_date = $1 AND status = $2',
    [tradeDate, 'completed'],
  );
  return result.rows.length > 0;
}

async function listReports(limit = 30) {
  const result = await pool.query(`
    SELECT id, trade_date::text, title, summary, status, created_at
    FROM reports
    ORDER BY trade_date DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}

async function getReportByDate(tradeDate) {
  const result = await pool.query(`
    SELECT
      r.id,
      r.trade_date::text AS trade_date,
      r.title,
      r.summary,
      r.content,
      r.status,
      r.created_at,
      r.market_snapshot_id,
      m.market_data
    FROM reports r
    LEFT JOIN market_snapshots m ON r.market_snapshot_id = m.id
    WHERE r.trade_date = $1
  `, [tradeDate]);

  if (result.rows.length === 0) return null;

  const report = result.rows[0];
  return {
    ...report,
    market_data: report.market_data || null,
  };
}

async function getLatestReport() {
  const result = await pool.query(`
    SELECT trade_date::text AS trade_date
    FROM reports
    WHERE status = 'completed'
    ORDER BY trade_date DESC
    LIMIT 1
  `);
  if (result.rows.length === 0) return null;
  return getReportByDate(result.rows[0].trade_date);
}

async function closeDb() {
  await pool.end();
}

module.exports = {
  pool,
  initDb,
  closeDb,
  getTodayDate,
  saveMarketSnapshot,
  saveReport,
  hasReportForDate,
  listReports,
  getReportByDate,
  getLatestReport,
};
