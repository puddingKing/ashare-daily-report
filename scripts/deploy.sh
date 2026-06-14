#!/usr/bin/env bash
set -euo pipefail

# 用法:
#   ./scripts/deploy.sh user@your-server-ip
# 或:
#   DEPLOY_HOST=user@1.2.3.4 CURSOR_API_KEY=sk-xxx ./scripts/deploy.sh

HOST="${1:-${DEPLOY_HOST:-}}"
APP_DIR="${DEPLOY_DIR:-/opt/ashare-daily-report}"
PORT="${DEPLOY_PORT:-3080}"

if [[ -z "$HOST" ]]; then
  echo "用法: ./scripts/deploy.sh user@server-ip"
  echo "或设置环境变量 DEPLOY_HOST"
  exit 1
fi

if [[ -z "${CURSOR_API_KEY:-}" ]]; then
  echo "错误: 请设置 CURSOR_API_KEY 环境变量"
  echo "示例: CURSOR_API_KEY=sk-xxx ./scripts/deploy.sh user@server-ip"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "==> 部署目标: $HOST:$APP_DIR"

echo "==> 同步项目文件..."
ssh "$HOST" "mkdir -p $APP_DIR"
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude data \
  --exclude .env \
  "$ROOT_DIR/" "$HOST:$APP_DIR/"

echo "==> 写入 .env 并启动服务..."
ssh "$HOST" bash -s <<EOF
set -euo pipefail
cd "$APP_DIR"

cat > .env <<ENVEOF
CURSOR_API_KEY=${CURSOR_API_KEY}
PORT=${PORT}
TZ=Asia/Shanghai
CRON_SCHEDULE=0 16 * * *
ENABLE_SCHEDULER=true
DATABASE_URL=postgresql://ashare:ashare@db:5432/ashare_report
ENVEOF

if ! command -v docker >/dev/null 2>&1; then
  echo "错误: 服务器未安装 Docker，请先安装 Docker 和 Docker Compose"
  exit 1
fi

docker compose down 2>/dev/null || true
docker compose up -d --build

echo ""
echo "部署完成！"
docker compose ps
echo ""
echo "访问地址: http://\$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print \$1}'):${PORT}"
EOF

echo "==> 全部完成"
