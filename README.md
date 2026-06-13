# A 股每日分析报告

每日 8:00（北京时间）自动采集 A 股大盘数据，通过 Cursor CLI 生成分析报告，存入 SQLite 数据库，并通过 Web 页面展示。

## 功能

- 采集主要指数（上证、深证、创业板、科创50、北证50）
- 统计涨跌家数、北向资金流向
- 使用 Cursor Agent 生成 Markdown 分析报告（可回退到模板）
- 定时任务 + 手动触发 API
- 历史报告列表与详情页

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 CURSOR_API_KEY
```

API Key 获取：[Cursor Settings](https://cursor.com/settings)

### 2. 本地运行

```bash
npm install
npm start
```

访问 http://localhost:3000

### 3. 手动执行一次任务（测试）

```bash
npm run task
# 强制重新生成当天报告
npm run task:force
```

### 4. Docker 部署

```bash
# 创建 .env 并设置 CURSOR_API_KEY
echo "CURSOR_API_KEY=你的密钥" > .env

docker compose up -d --build
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports` | 报告列表 |
| GET | `/api/reports/latest` | 最新报告 |
| GET | `/api/reports/:date` | 指定日期报告（YYYY-MM-DD） |
| POST | `/api/tasks/run` | 手动触发任务 |
| POST | `/api/tasks/run?force=true` | 强制重新生成 |
| GET | `/health` | 健康检查 |

## 定时任务

默认每天 **8:00（Asia/Shanghai）** 执行，可通过环境变量调整：

```env
CRON_SCHEDULE=0 8 * * *
TZ=Asia/Shanghai
ENABLE_SCHEDULER=true
```

## 目录结构

```
src/
  market/fetchMarket.js   # A 股数据采集（东方财富 API）
  report/generateReport.js # Cursor CLI 报告生成
  jobs/dailyTask.js       # 每日任务编排
  scheduler.js            # node-cron 定时器
  routes/api.js             # REST API
  server.js               # 入口
public/                   # 展示页面
data/                     # SQLite 数据库（Docker volume）
```

## 注意事项

1. **交易日**：周末/节假日仍会采集当时可用的行情快照；如需仅交易日执行，可在 `dailyTask.js` 中加交易日判断。
2. **Cursor CLI**：Docker 镜像内已安装；本地需执行 `curl https://cursor.com/install -fsS | bash`。
3. **无 API Key**：未配置 `CURSOR_API_KEY` 时会使用规则模板生成简报，功能仍可用。
4. **数据源**：使用东方财富公开接口，仅供个人学习使用。
