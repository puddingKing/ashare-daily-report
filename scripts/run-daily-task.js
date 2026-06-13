require('dotenv').config();

const { runDailyTask } = require('../src/jobs/dailyTask');

const force = process.argv.includes('--force');

runDailyTask({ force })
  .then((result) => {
    console.log('[done]', result);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[error]', err);
    process.exit(1);
  });
