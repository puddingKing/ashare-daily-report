const cron = require('node-cron');
const { runDailyTask } = require('./jobs/dailyTask');

function startScheduler() {
  const enabled = process.env.ENABLE_SCHEDULER !== 'false';
  if (!enabled) {
    console.log('[scheduler] 定时任务已禁用 (ENABLE_SCHEDULER=false)');
    return;
  }

  const schedule = process.env.CRON_SCHEDULE || '0 8 * * *';
  const timezone = process.env.TZ || 'Asia/Shanghai';

  if (!cron.validate(schedule)) {
    throw new Error(`无效的 CRON_SCHEDULE: ${schedule}`);
  }

  cron.schedule(schedule, async () => {
    console.log(`[scheduler] 触发定时任务 (${schedule}, ${timezone})`);
    try {
      await runDailyTask();
    } catch (err) {
      console.error('[scheduler] 任务执行失败:', err);
    }
  }, { timezone });

  console.log(`[scheduler] 已启动，计划: ${schedule} (${timezone})`);
}

module.exports = { startScheduler };
