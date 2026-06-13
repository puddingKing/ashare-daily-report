require('dotenv').config();

const express = require('express');
const path = require('path');
const apiRouter = require('./routes/api');
const { startScheduler } = require('./scheduler');
const { initDb } = require('./db');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('缺少 DATABASE_URL 环境变量');
  }

  await initDb();
  startScheduler();

  app.listen(port, () => {
    console.log(`[server] 服务已启动: http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error('[server] 启动失败:', err);
  process.exit(1);
});
