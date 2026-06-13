const {
  getTodayDate,
  saveMarketSnapshot,
  saveReport,
  hasReportForDate,
} = require('../db');
const { fetchMarketOverview } = require('../market/fetchMarket');
const { generateReport } = require('../report/generateReport');
const { isTradingDay } = require('../market/tradingCalendar');

async function runDailyTask({ force = false } = {}) {
  const tradeDate = getTodayDate();
  console.log(`[task] 开始执行每日任务，日期: ${tradeDate}`);

  if (!force) {
    const tradingCheck = await isTradingDay(tradeDate);
    if (!tradingCheck.trading) {
      const detail = tradingCheck.holidayName
        ? `${tradingCheck.reason}（${tradingCheck.holidayName}）`
        : tradingCheck.reason;
      console.log(`[task] ${tradeDate} 非交易日，跳过 (${detail})`);
      return { skipped: true, tradeDate, reason: 'non_trading_day', detail: tradingCheck };
    }
    console.log(`[task] ${tradeDate} 为交易日，继续执行`);
  }

  if (!force && await hasReportForDate(tradeDate)) {
    console.log(`[task] ${tradeDate} 报告已存在，跳过`);
    return { skipped: true, tradeDate, reason: 'already_exists' };
  }

  console.log('[task] 正在获取 A 股大盘数据...');
  const marketData = await fetchMarketOverview();
  const snapshotId = await saveMarketSnapshot(tradeDate, marketData);
  console.log('[task] 市场数据已保存');

  console.log('[task] 正在生成分析报告...');
  const report = await generateReport(marketData);

  await saveReport({
    tradeDate,
    title: report.title,
    summary: report.summary,
    content: report.content,
    marketSnapshotId: snapshotId,
    status: 'completed',
  });

  console.log(`[task] 报告已生成: ${report.title}`);
  return {
    skipped: false,
    tradeDate,
    title: report.title,
    summary: report.summary,
  };
}

module.exports = { runDailyTask };
