const reportListEl = document.getElementById('reportList');
const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('empty');
const reportViewEl = document.getElementById('reportView');
const refreshBtn = document.getElementById('refreshBtn');

let reports = [];
let activeDate = null;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `请求失败: ${res.status}`);
  }
  return res.json();
}

function formatChange(value) {
  if (value == null) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}%`;
}

function changeClass(value) {
  if (value == null) return '';
  return value >= 0 ? 'up' : 'down';
}

function renderMarketCards(marketData) {
  const container = document.getElementById('marketCards');
  if (!marketData?.indices) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = marketData.indices.map((idx) => `
    <div class="card">
      <div class="name">${idx.name}</div>
      <div class="price">${idx.price ?? '-'}</div>
      <div class="change ${changeClass(idx.changePercent)}">${formatChange(idx.changePercent)}</div>
    </div>
  `).join('');
}

function renderReportList() {
  reportListEl.innerHTML = reports.map((item) => `
    <li data-date="${item.trade_date}" class="${item.trade_date === activeDate ? 'active' : ''}">
      <span class="date">${item.trade_date}</span>
      <span class="title">${item.title}</span>
    </li>
  `).join('');

  reportListEl.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => loadReport(li.dataset.date));
  });
}

async function loadReport(date) {
  loadingEl.classList.remove('hidden');
  reportViewEl.classList.add('hidden');

  try {
    const { data } = await fetchJson(`api/reports/${date}`);
    activeDate = date;
    renderReportList();

    document.getElementById('reportDate').textContent = `交易日: ${data.trade_date}`;
    document.getElementById('reportCreated').textContent = `生成时间: ${data.created_at}`;
    document.getElementById('reportTitle').textContent = data.title;
    document.getElementById('reportSummary').textContent = data.summary || '';
    document.getElementById('reportContent').innerHTML = data.content_html;
    renderMarketCards(data.market_data);

    reportViewEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
  } catch (err) {
    alert(err.message);
  } finally {
    loadingEl.classList.add('hidden');
  }
}

async function init() {
  try {
    const { data } = await fetchJson('api/reports?limit=30');
    reports = data;

    if (reports.length === 0) {
      loadingEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }

    renderReportList();
    await loadReport(reports[0].trade_date);
  } catch (err) {
    loadingEl.textContent = `加载失败: ${err.message}`;
  }
}

refreshBtn.addEventListener('click', init);
init();
