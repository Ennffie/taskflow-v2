const SILLY_TITLE_MAP: Record<string, string> = {
  enfield: 'Enfield 大人',
  bro: '恩公',
  alice: 'Alice 皇后',
  silvie: 'Silvie 公主',
  pamela: 'Pamela 貴妃娘娘',
  claire: 'Claire 姑娘',
  shani: 'Shani 姑娘',
};

function normalizeName(name?: string | null) {
  return (name || '').trim().toLowerCase();
}

export function getPreferredCallName(name?: string | null) {
  const trimmed = (name || '').trim();
  if (!trimmed) return '大人';

  const normalized = normalizeName(trimmed);
  if (SILLY_TITLE_MAP[normalized]) return SILLY_TITLE_MAP[normalized];

  const firstName = trimmed.split(/\s+/)[0] || trimmed;
  const normalizedFirstName = normalizeName(firstName);
  if (SILLY_TITLE_MAP[normalizedFirstName]) return SILLY_TITLE_MAP[normalizedFirstName];

  return `${firstName} 大人`;
}
