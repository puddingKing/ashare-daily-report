FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    bash \
    && rm -rf /var/lib/apt/lists/*

# 安装 Cursor CLI
RUN curl https://cursor.com/install -fsS | bash
ENV PATH="/root/.cursor/bin:/root/.local/bin:${PATH}"

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Asia/Shanghai
ENV DB_PATH=/app/data/reports.db
ENV CRON_SCHEDULE=0 8 * * *
ENV ENABLE_SCHEDULER=true

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "src/server.js"]
