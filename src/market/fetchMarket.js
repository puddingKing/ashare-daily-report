const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ashare-daily-report/1.0)',
        Referer: 'https://quote.eastmoney.com/',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`JSON 解析失败: ${err.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('请求超时'));
    });
  });
}

const INDEX_CONFIG = [
  { secid: '1.000001', name: '上证指数', code: '000001' },
  { secid: '0.399001', name: '深证成指', code: '399001' },
  { secid: '0.399006', name: '创业板指', code: '399006' },
  { secid: '1.000688', name: '科创50', code: '000688' },
  { secid: '0.899050', name: '北证50', code: '899050' },
];

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '-' || Number.isNaN(Number(value))) {
    return null;
  }
  return Number(Number(value).toFixed(digits));
}

async function fetchIndices() {
  const secids = INDEX_CONFIG.map((item) => item.secid).join(',');
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f5,f6,f12,f14,f15,f16,f17,f18&secids=${secids}`;
  const json = await fetchJson(url);
  const diff = json?.data?.diff || [];

  return INDEX_CONFIG.map((config) => {
    const item = diff.find((row) => row.f12 === config.code) || {};
    return {
      name: config.name,
      code: config.code,
      price: formatNumber(item.f2),
      changePercent: formatNumber(item.f3),
      changeAmount: formatNumber(item.f4),
      volume: formatNumber(item.f5, 0),
      turnover: formatNumber(item.f6, 0),
      open: formatNumber(item.f15),
      high: formatNumber(item.f16),
      low: formatNumber(item.f17),
      prevClose: formatNumber(item.f18),
    };
  });
}

async function fetchMarketBreadth() {
  const url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=1&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f3';
  const json = await fetchJson(url);
  const total = json?.data?.total || 0;

  const upUrl = `${url}&fid=f3&po=1`;
  const downUrl = `${url}&fid=f3&po=0`;

  const [upJson, downJson] = await Promise.all([
    fetchJson(`${upUrl}&pz=5000`),
    fetchJson(`${downUrl}&pz=5000`),
  ]);

  const upList = upJson?.data?.diff || [];
  const downList = downJson?.data?.diff || [];

  const up = upList.filter((item) => Number(item.f3) > 0).length;
  const down = downList.filter((item) => Number(item.f3) < 0).length;
  const flat = Math.max(total - up - down, 0);

  return { total, up, down, flat };
}

async function fetchNorthboundFlow() {
  const url = 'https://push2.eastmoney.com/api/qt/kamt.rtmin/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56&ut=fa5fd1943c7b386f172d6893dbfba10b';
  const json = await fetchJson(url);
  const data = json?.data || {};

  return {
    northNetInflow: formatNumber(data.northNetInflow),
    northTotalInflow: formatNumber(data.northMoney),
    shConnect: formatNumber(data.hk2sh),
    szConnect: formatNumber(data.hk2sz),
  };
}

async function fetchMarketOverview() {
  const [indices, breadth, northbound] = await Promise.all([
    fetchIndices(),
    fetchMarketBreadth(),
    fetchNorthboundFlow().catch(() => ({
      northNetInflow: null,
      northTotalInflow: null,
      shConnect: null,
      szConnect: null,
      note: '北向资金数据暂不可用',
    })),
  ]);

  const now = new Date();
  const fetchedAt = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

  return {
    fetchedAt,
    tradeDate: now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }),
    indices,
    breadth,
    northbound,
  };
}

module.exports = {
  fetchMarketOverview,
};
