const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execFileAsync = promisify(execFile);

function buildPrompt(marketData) {
  const lines = [
    '你是一位专业的 A 股市场分析师。请根据以下大盘数据，生成一份简洁、专业的每日市场分析报告。',
    '',
    '要求：',
    '1. 使用 Markdown 格式',
    '2. 包含：市场概览、主要指数表现、市场情绪（涨跌家数）、资金面（北向资金）、后市展望',
    '3. 语言简洁专业，适合投资者阅读',
    '4. 不要编造数据中不存在的信息',
    '5. 报告开头用一行标题（# 开头），第二行写一句话摘要',
    '',
    '--- 市场数据 ---',
    JSON.stringify(marketData, null, 2),
  ];

  return lines.join('\n');
}

function extractTitleAndSummary(markdown) {
  const lines = markdown.trim().split('\n');
  let title = 'A 股每日市场分析报告';
  let summary = '';
  let contentStart = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      contentStart = i + 1;
      break;
    }
  }

  for (let i = contentStart; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    summary = line.replace(/^\*+\s*/, '').slice(0, 200);
    break;
  }

  return { title, summary };
}

async function findAgentBinary() {
  const candidates = [
    process.env.AGENT_BIN,
    path.join(os.homedir(), '.cursor', 'bin', 'agent'),
    path.join(os.homedir(), '.local', 'bin', 'agent'),
    'agent',
  ].filter(Boolean);

  for (const bin of candidates) {
    if (bin !== 'agent' && !fs.existsSync(bin)) continue;
    try {
      await execFileAsync(bin, ['--version'], { timeout: 10000 });
      return bin;
    } catch {
      // try next
    }
  }

  throw new Error('未找到 Cursor CLI (agent)。请安装: curl https://cursor.com/install -fsS | bash');
}

async function generateReportWithCursor(marketData) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 CURSOR_API_KEY 环境变量，无法调用 Cursor Agent 生成报告');
  }

  const agentBin = await findAgentBinary();
  const prompt = buildPrompt(marketData);

  const { stdout, stderr } = await execFileAsync(
    agentBin,
    ['-p', prompt, '--output-format', 'text', '--force'],
    {
      timeout: 300000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        CURSOR_API_KEY: apiKey,
      },
    },
  );

  const content = stdout.trim();
  if (!content) {
    throw new Error(`Cursor Agent 未返回内容${stderr ? `: ${stderr}` : ''}`);
  }

  const { title, summary } = extractTitleAndSummary(content);
  return { title, summary, content };
}

function generateFallbackReport(marketData) {
  const { indices, breadth, northbound, tradeDate } = marketData;

  const indexLines = indices.map((idx) => {
    const sign = idx.changePercent >= 0 ? '+' : '';
    return `- **${idx.name}**：${idx.price ?? '-'}（${sign}${idx.changePercent ?? '-'}%）`;
  }).join('\n');

  const content = [
    `# ${tradeDate} A 股市场简报`,
    '',
    `截至 ${marketData.fetchedAt}，A 股主要指数表现分化，上涨 ${breadth.up} 家，下跌 ${breadth.down} 家，平盘 ${breadth.flat} 家。`,
    '',
    '## 主要指数',
    indexLines,
    '',
    '## 市场情绪',
    `- 上涨家数：${breadth.up}`,
    `- 下跌家数：${breadth.down}`,
    `- 平盘家数：${breadth.flat}`,
    `- 合计：${breadth.total}`,
    '',
    '## 北向资金',
    northbound.northNetInflow != null
      ? `- 北向净流入：${northbound.northNetInflow} 亿元`
      : '- 北向资金数据暂不可用',
    '',
    '## 说明',
    '本报告由规则模板自动生成（未使用 Cursor Agent）。配置 CURSOR_API_KEY 后可启用 AI 深度分析。',
  ].join('\n');

  return {
    title: `${tradeDate} A 股市场简报`,
    summary: `上涨 ${breadth.up} 家，下跌 ${breadth.down} 家`,
    content,
  };
}

async function generateReport(marketData) {
  if (process.env.CURSOR_API_KEY) {
    try {
      return await generateReportWithCursor(marketData);
    } catch (err) {
      console.warn('[report] Cursor Agent 生成失败，使用模板回退:', err.message);
    }
  } else {
    console.warn('[report] 未配置 CURSOR_API_KEY，使用模板生成报告');
  }

  return generateFallbackReport(marketData);
}

module.exports = {
  generateReport,
  generateFallbackReport,
};
