# A 股每日分析报告

每日 16:00（北京时间）在 **A 股交易日** 自动采集大盘数据，通过 Cursor CLI 生成分析报告，存入 PostgreSQL 数据库，并通过 Web 页面展示。

## 功能

- 采集主要指数（上证、深证、创业板、科创50、北证50）
- 统计涨跌家数、北向资金流向
- **仅交易日执行**（周一至周五 + 排除法定节假日）
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

### 2. Docker 部署（推荐）

```bash
# 创建 .env 并设置 CURSOR_API_KEY
echo "CURSOR_API_KEY=你的密钥" > .env

docker compose up -d --build
```

访问 http://localhost:3000

线上地址（已配置 nginx）：https://www.luca0527.art/market/

### 3. 本地运行

需先启动 PostgreSQL，再配置 `DATABASE_URL`：

```bash
# 仅启动数据库
docker compose up -d db

npm install
npm start
```

### 4. 手动执行任务

```bash
# 交易日正常执行
docker compose exec app node scripts/run-daily-task.js

# 强制重新生成（跳过交易日检查和重复检查，适合测试）
docker compose exec app node scripts/run-daily-task.js --force
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports` | 报告列表 |
| GET | `/api/reports/latest` | 最新报告 |
| GET | `/api/reports/:date` | 指定日期报告（YYYY-MM-DD） |
| POST | `/api/tasks/run` | 手动触发（仅交易日） |
| POST | `/api/tasks/run?force=true` | 强制触发（忽略交易日检查） |
| GET | `/health` | 健康检查 |

## 交易日判断逻辑

定时任务和手动触发（无 `force`）时，会依次检查：

1. **周一至周五**（A 股不在调休周六日开市）
2. **非法定节假日**（优先在线 API，失败时回退本地 `holidays.json`）

非交易日会跳过并记录日志，返回 `{ skipped: true, reason: 'non_trading_day' }`。

`--force` 或 `?force=true` 可跳过交易日检查和重复检查，用于测试。

## 环境变量

```env
DATABASE_URL=postgresql://ashare:ashare@db:5432/ashare_report
CURSOR_API_KEY=xxx
CRON_SCHEDULE=0 16 * * *
TZ=Asia/Shanghai
ENABLE_SCHEDULER=true
```

## 目录结构

```
src/
  market/
    fetchMarket.js        # A 股数据采集
    tradingCalendar.js    # 交易日判断
  report/generateReport.js
  jobs/dailyTask.js
  scheduler.js
  routes/api.js
  db.js                   # PostgreSQL
  server.js
public/                   # 展示页面
```

## 注意事项

1. **Cursor CLI**：Docker 镜像内已安装；本地需执行 `curl https://cursor.com/install -fsS | bash`。
2. **无 API Key**：未配置 `CURSOR_API_KEY` 时会使用规则模板生成简报。
3. **数据源**：使用东方财富公开接口，仅供个人学习使用。
4. **数据库**：Docker Compose 默认 PostgreSQL 16，数据持久化在 `pg-data` volume。
5. **Nginx**：通过 `https://www.luca0527.art/market/` 访问；宝塔面板配置文件见 `deploy/nginx/www.luca0527.art.bt.conf`。
