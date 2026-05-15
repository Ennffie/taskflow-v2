export type Birthday = { month: number; day: number };

export type ZodiacKey =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

export type DailyHoroscope = {
  signKey: ZodiacKey;
  signLabel: string;
  message: string;
  luckyColor: string;
  luckyThing: string;
};

const MEMBER_BIRTHDAYS: Array<{ matchers: string[]; birthday: Birthday }> = [
  { matchers: ['enfield law', 'enfield', 'enterr l'], birthday: { month: 9, day: 24 } },
  { matchers: ['alice'], birthday: { month: 6, day: 18 } },
  { matchers: ['mandy'], birthday: { month: 3, day: 13 } },
  { matchers: ['claire'], birthday: { month: 1, day: 19 } },
];

const ZODIAC_META: Record<ZodiacKey, { label: string; start: [number, number]; end: [number, number] }> = {
  aries: { label: '白羊座', start: [3, 21], end: [4, 19] },
  taurus: { label: '金牛座', start: [4, 20], end: [5, 20] },
  gemini: { label: '雙子座', start: [5, 21], end: [6, 20] },
  cancer: { label: '巨蟹座', start: [6, 21], end: [7, 22] },
  leo: { label: '獅子座', start: [7, 23], end: [8, 22] },
  virgo: { label: '處女座', start: [8, 23], end: [9, 22] },
  libra: { label: '天秤座', start: [9, 23], end: [10, 22] },
  scorpio: { label: '天蠍座', start: [10, 23], end: [11, 21] },
  sagittarius: { label: '人馬座', start: [11, 22], end: [12, 21] },
  capricorn: { label: '山羊座', start: [12, 22], end: [1, 19] },
  aquarius: { label: '水瓶座', start: [1, 20], end: [2, 18] },
  pisces: { label: '雙魚座', start: [2, 19], end: [3, 20] },
};

const HOROSCOPE_BANK: Record<ZodiacKey, Array<{ message: string; luckyColor: string; luckyThing: string }>> = {
  aries: [
    { message: '今天行動力幾好，先搞最難嗰件，後面會順好多。', luckyColor: '珊瑚紅', luckyThing: '短清單' },
    { message: '有啲衝勁，但唔使樣樣一口氣衝，留少少位畀自己抖抖。', luckyColor: '蜜桃橙', luckyThing: '暖水' },
  ],
  taurus: [
    { message: '穩穩陣陣係你今日優勢，慢慢砌都可以好靚。', luckyColor: '抹茶綠', luckyThing: '耳機' },
    { message: '今日適合執靚細節，尤其係要人睇落舒服嗰啲位。', luckyColor: '奶茶啡', luckyThing: '便條紙' },
  ],
  gemini: [
    { message: '溝通運唔錯，今日講清楚 scope 會幫你慳返好多時間。', luckyColor: '天空藍', luckyThing: '訊息草稿' },
    { message: '腦轉得快，記得先定主線，唔好俾太多想法拉走。', luckyColor: '亮黃', luckyThing: 'checklist' },
  ],
  cancer: [
    { message: '今日直覺幾準，對人同對氣氛嘅感受都幫到你判斷。', luckyColor: '月光白', luckyThing: '軟墊' },
    { message: '先顧好自己節奏，舒服咗先會做得更順。', luckyColor: '淺海藍', luckyThing: '保溫杯' },
  ],
  leo: [
    { message: '今日幾有主場氣勢，你定咗方向，其他嘢就會跟得順。', luckyColor: '陽光金', luckyThing: '金色小物' },
    { message: '有表現機會，但最好用作品講說話，會更有說服力。', luckyColor: '暖橙金', luckyThing: '亮色筆' },
  ],
  virgo: [
    { message: '細節運在線，今日好適合執 UI、文案同 flow。', luckyColor: '鼠尾草綠', luckyThing: '標註工具' },
    { message: '先做最關鍵嗰一格，整體效率會高過你想像。', luckyColor: '霧灰綠', luckyThing: '細字筆' },
  ],
  libra: [
    { message: '今日平衡感幾好，適合先處理最重要一件事，再慢慢收靚其他位。', luckyColor: '淺藍', luckyThing: '圓角卡片' },
    { message: '溝通同審美運都唔錯，今日講法溫柔啲，反而更易推到事情。', luckyColor: '薰衣草紫', luckyThing: '香香紙巾' },
    { message: '今日適合先定優先次序，心定咗，成個 flow 就會順返晒。', luckyColor: '奶油白', luckyThing: '小掛飾' },
  ],
  scorpio: [
    { message: '專注力唔錯，啱做啲要深入落去先搞得掂嘅事。', luckyColor: '酒紅', luckyThing: '深色記事本' },
    { message: '今日少講廢話、直切重點，反而更易服眾。', luckyColor: '墨紫', luckyThing: '靜音模式' },
  ],
  sagittarius: [
    { message: '今日腦入面會有新點子，記得快手記低，唔好俾佢飛走。', luckyColor: '湖水綠', luckyThing: 'memo app' },
    { message: '節奏輕快，適合推進卡咗一排嘅嘢，但唔好開太多線。', luckyColor: '亮天藍', luckyThing: '輕音樂' },
  ],
  capricorn: [
    { message: '穩定係你今日王牌，逐步推進會比硬衝更快見效。', luckyColor: '石墨灰', luckyThing: '時鐘' },
    { message: '今日適合處理責任位，做實一樣就已經好有交代。', luckyColor: '深藍灰', luckyThing: '整齊桌面' },
  ],
  aquarius: [
    { message: '今日適合用新方法解舊問題，可能會有幾醒神嘅靈感。', luckyColor: '電光藍', luckyThing: '便利貼' },
    { message: '想法多係優勢，但記得揀一條最值得行嘅路先。', luckyColor: '薄荷藍', luckyThing: '耳機' },
  ],
  pisces: [
    { message: '今日感受力幾強，做同人有關、同體驗有關嘅決定會特別準。', luckyColor: '霧粉藍', luckyThing: '柔軟小物' },
    { message: '放鬆少少反而會做得更好，唔使逼自己太緊。', luckyColor: '海鹽白', luckyThing: '深呼吸' },
  ],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function getHongKongDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function formatHongKongDateLabel(date = new Date()): string {
  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

export function formatHongKongTimeLabel(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function resolveBirthday(name?: string | null, email?: string | null): Birthday | null {
  const haystacks = [normalize(name || ''), normalize(email || '')].filter(Boolean);
  for (const item of MEMBER_BIRTHDAYS) {
    if (item.matchers.some((matcher) => haystacks.some((haystack) => haystack.includes(normalize(matcher))))) {
      return item.birthday;
    }
  }
  return null;
}

export function getZodiac(month: number, day: number): ZodiacKey {
  const value = month * 100 + day;
  if (value >= 321 && value <= 419) return 'aries';
  if (value >= 420 && value <= 520) return 'taurus';
  if (value >= 521 && value <= 620) return 'gemini';
  if (value >= 621 && value <= 722) return 'cancer';
  if (value >= 723 && value <= 822) return 'leo';
  if (value >= 823 && value <= 922) return 'virgo';
  if (value >= 923 && value <= 1022) return 'libra';
  if (value >= 1023 && value <= 1121) return 'scorpio';
  if (value >= 1122 && value <= 1221) return 'sagittarius';
  if (value >= 1222 || value <= 119) return 'capricorn';
  if (value >= 120 && value <= 218) return 'aquarius';
  return 'pisces';
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getDailyHoroscopeForProfile(params: { name?: string | null; email?: string | null }, date = new Date()): DailyHoroscope {
  const birthday = resolveBirthday(params.name, params.email) ?? { month: 9, day: 24 };
  const signKey = getZodiac(birthday.month, birthday.day);
  const bank = HOROSCOPE_BANK[signKey];
  const dateKey = getHongKongDateString(date);
  const pick = bank[hash(`${signKey}-${dateKey}`) % bank.length];
  return {
    signKey,
    signLabel: ZODIAC_META[signKey].label,
    message: pick.message,
    luckyColor: pick.luckyColor,
    luckyThing: pick.luckyThing,
  };
}
