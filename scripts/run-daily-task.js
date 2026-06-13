require('dotenv').config();

const { runDailyTask } = require('../src/jobs/dailyTask');
const { initDb, closeDb } = require('../src/db');

const force = process.argv.includes('--force');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('缺少 DATABASE_URL 环境变量');
  }

  await initDb();
  const result = await runDailyTask({ force });
  console.log('[done]', result);
  await closeDb();
}

main().catch(async (err) => {
  console.error('[error]', err);
  try { await closeDb(); } catch { /* ignore */ }
  process.exit(1);
});
