const express = require('express');
const { marked } = require('marked');
const { runDailyTask } = require('../jobs/dailyTask');
const {
  listReports,
  getReportByDate,
  getLatestReport,
} = require('../db');

const router = express.Router();

router.get('/reports', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const data = await listReports(limit);
    res.json({ data });
  } catch (err) {
    console.error('[api] 获取报告列表失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/reports/latest', async (req, res) => {
  try {
    const report = await getLatestReport();
    if (!report) {
      return res.status(404).json({ error: '暂无报告' });
    }
    res.json({ data: formatReport(report) });
  } catch (err) {
    console.error('[api] 获取最新报告失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/reports/:date', async (req, res) => {
  try {
    const report = await getReportByDate(req.params.date);
    if (!report) {
      return res.status(404).json({ error: '报告不存在' });
    }
    res.json({ data: formatReport(report) });
  } catch (err) {
    console.error('[api] 获取报告失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/tasks/run', async (req, res) => {
  const force = req.query.force === 'true';
  try {
    const result = await runDailyTask({ force });
    res.json({ data: result });
  } catch (err) {
    console.error('[api] 手动触发任务失败:', err);
    res.status(500).json({ error: err.message });
  }
});

function formatReport(report) {
  return {
    id: report.id,
    trade_date: report.trade_date,
    title: report.title,
    summary: report.summary,
    content: report.content,
    content_html: marked.parse(report.content),
    status: report.status,
    created_at: report.created_at,
    market_data: report.market_data,
  };
}

module.exports = router;
