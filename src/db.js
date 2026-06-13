const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || './data/reports.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS market_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_date TEXT NOT NULL UNIQUE,
    market_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_date TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    market_snapshot_id INTEGER,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (market_snapshot_id) REFERENCES market_snapshots(id)
  );

  CREATE INDEX IF NOT EXISTS idx_reports_trade_date ON reports(trade_date DESC);
`);

function getTodayDate() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

function saveMarketSnapshot(tradeDate, marketData) {
  const stmt = db.prepare(`
    INSERT INTO market_snapshots (trade_date, market_data)
    VALUES (?, ?)
    ON CONFLICT(trade_date) DO UPDATE SET
      market_data = excluded.market_data,
      created_at = datetime('now', 'localtime')
  `);
  const result = stmt.run(tradeDate, JSON.stringify(marketData));
  const row = db.prepare('SELECT id FROM market_snapshots WHERE trade_date = ?').get(tradeDate);
  return row.id;
}

function saveReport({ tradeDate, title, summary, content, marketSnapshotId, status = 'completed' }) {
  const stmt = db.prepare(`
    INSERT INTO reports (trade_date, title, summary, content, market_snapshot_id, status)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(trade_date) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      content = excluded.content,
      market_snapshot_id = excluded.market_snapshot_id,
      status = excluded.status,
      created_at = datetime('now', 'localtime')
  `);
  stmt.run(tradeDate, title, summary, content, marketSnapshotId, status);
}

function hasReportForDate(tradeDate) {
  const row = db.prepare('SELECT id FROM reports WHERE trade_date = ? AND status = ?').get(tradeDate, 'completed');
  return Boolean(row);
}

function listReports(limit = 30) {
  return db.prepare(`
    SELECT id, trade_date, title, summary, status, created_at
    FROM reports
    ORDER BY trade_date DESC
    LIMIT ?
  `).all(limit);
}

function getReportByDate(tradeDate) {
  const report = db.prepare(`
    SELECT r.*, m.market_data
    FROM reports r
    LEFT JOIN market_snapshots m ON r.market_snapshot_id = m.id
    WHERE r.trade_date = ?
  `).get(tradeDate);

  if (!report) return null;

  return {
    ...report,
    market_data: report.market_data ? JSON.parse(report.market_data) : null,
  };
}

function getLatestReport() {
  const row = db.prepare(`
    SELECT trade_date FROM reports WHERE status = 'completed' ORDER BY trade_date DESC LIMIT 1
  `).get();
  return row ? getReportByDate(row.trade_date) : null;
}

module.exports = {
  db,
  getTodayDate,
  saveMarketSnapshot,
  saveReport,
  hasReportForDate,
  listReports,
  getReportByDate,
  getLatestReport,
};
