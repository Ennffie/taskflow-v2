import { getHongKongDateString } from './horoscope';

export type PublicHolidayInfo = {
  name: string;
  greeting: string;
};

export type FunDayInfo = {
  title: string;
  message: string;
};

const HK_PUBLIC_HOLIDAYS: Record<string, PublicHolidayInfo> = {
  '2026-01-01': { name: '元旦', greeting: 'Hello 2026 元旦' },
  '2026-02-17': { name: '農曆年初一', greeting: '新年快樂 農曆年初一' },
  '2026-02-18': { name: '農曆年初二', greeting: '新年快樂 農曆年初二' },
  '2026-02-19': { name: '農曆年初三', greeting: '新年快樂 農曆年初三' },
  '2026-04-03': { name: 'Good Friday', greeting: 'Good Friday ✨' },
  '2026-04-04': { name: 'Holy Saturday', greeting: 'Holy Saturday ✨' },
  '2026-04-06': { name: 'Easter Monday', greeting: 'Happy Easter Monday 🐣' },
  '2026-04-07': { name: '清明節翌日補假', greeting: '清明節' },
  '2026-05-01': { name: '勞動節', greeting: '勞動節快樂' },
  '2026-05-25': { name: '佛誕補假', greeting: '佛誕 🙏' },
  '2026-06-19': { name: '端午節', greeting: '端午節快樂' },
  '2026-07-01': { name: '香港特別行政區成立紀念日', greeting: '回歸紀念日' },
  '2026-09-26': { name: '中秋節翌日', greeting: '中秋節快樂 🌕' },
  '2026-10-01': { name: '國慶日', greeting: '國慶日快樂' },
  '2026-10-19': { name: '重陽節補假', greeting: '重陽節' },
  '2026-12-25': { name: '聖誕節', greeting: 'Ho ho ho 聖誕節' },
  '2026-12-26': { name: '聖誕節後第一個周日', greeting: 'Boxing Day 🎁' },
};

const FUN_DAYS: Record<string, FunDayInfo> = {
  '01-01': { title: '新一年開張啦～', message: '今日適合偷偷許個願望 ✨' },
  '02-14': { title: '今日甜度超標 💘', message: '記得對重要嘅人溫柔啲呀。' },
  '04-01': { title: '今日愚人節～', message: '今日想整蠱邊個？ 😏' },
  '10-31': { title: '今晚可能有啲 spooky 哦 👻', message: '記得保留一點點玩心。' },
  '12-24': { title: '平安夜 mood loading ✨', message: '今晚不如對自己好少少。' },
  '12-31': { title: '今晚準備跨年啦～', message: '今年努力過嘅你，值得被好好稱讚。' },
};

export function getHongKongWeekday(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong',
    weekday: 'short',
  }).format(date);
}

export function isWeekendInHongKong(date = new Date()) {
  const weekday = getHongKongWeekday(date);
  return weekday === 'Sat' || weekday === 'Sun';
}

export function getPublicHolidayInfo(date = new Date()): PublicHolidayInfo | null {
  return HK_PUBLIC_HOLIDAYS[getHongKongDateString(date)] ?? null;
}

export function getFunDayInfo(date = new Date()): FunDayInfo | null {
  const [, month, day] = getHongKongDateString(date).split('-');
  return FUN_DAYS[`${month}-${day}`] ?? null;
}
