require('dotenv').config();

const express = require('express');
const path = require('path');
const apiRouter = require('./routes/api');
const { startScheduler } = require('./scheduler');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

startScheduler();

app.listen(port, () => {
  console.log(`[server] 服务已启动: http://localhost:${port}`);
});
