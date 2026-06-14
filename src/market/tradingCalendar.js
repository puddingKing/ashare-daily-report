const https = require('https');
const holidays = require('./holidays.json');

const HOLIDAY_API = 'https://api.jiejiariapi.com/v1/is_holiday';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ashare-daily-report/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`节假日 API 解析失败: ${err.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('节假日 API 请求超时')));
  });
}

function getWeekday(dateStr) {
  const date = new Date(`${dateStr}T12:00:00+08:00`);
  const weekday = date.toLocaleDateString('en-US', { timeZone: 'Asia/Shanghai', weekday: 'short' });
  const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[weekday] || 0;
}

function isWeekday(dateStr) {
  const day = getWeekday(dateStr);
  return day >= 1 && day <= 5;
}

function isLocalHoliday(dateStr) {
  const year = dateStr.slice(0, 4);
  const yearHolidays = holidays[year] || [];
  return yearHolidays.includes(dateStr);
}

async function fetchHolidayInfo(dateStr) {
  const json = await fetchJson(`${HOLIDAY_API}?date=${dateStr}`);
  if (typeof json.is_holiday !== 'boolean') {
    throw new Error('节假日 API 返回格式异常');
  }
  return {
    isHoliday: json.is_holiday,
    name: json.holiday?.name || null,
  };
}

/**
 * A 股交易日判断：
 * 1. 必须是周一至周五（股市不在调休周六日开市）
 * 2. 不能是法定节假日
 */
async function isTradingDay(dateStr) {
  if (!isWeekday(dateStr)) {
    return { trading: false, reason: 'weekend', date: dateStr };
  }

  try {
    const holiday = await fetchHolidayInfo(dateStr);
    if (holiday.isHoliday) {
      return {
        trading: false,
        reason: 'holiday',
        date: dateStr,
        holidayName: holiday.name,
      };
    }
    return { trading: true, reason: 'trading_day', date: dateStr, holidayName: null };
  } catch (err) {
    console.warn(`[trading] 节假日 API 不可用，使用本地节假日数据: ${err.message}`);
    if (isLocalHoliday(dateStr)) {
      return { trading: false, reason: 'holiday_local', date: dateStr };
    }
    return { trading: true, reason: 'weekday_fallback', date: dateStr };
  }
}

module.exports = {
  isTradingDay,
  isWeekday,
};
