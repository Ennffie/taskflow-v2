const BUILD_DATE = new Date();
const ymd = BUILD_DATE.toISOString().slice(0, 10).replace(/-/g, '');
const hm = `${String(BUILD_DATE.getHours()).padStart(2, '0')}${String(BUILD_DATE.getMinutes()).padStart(2, '0')}`;
export const APP_VERSION = `v2.5.18-${ymd}-${hm}`;
