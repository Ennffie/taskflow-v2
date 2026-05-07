export const MAX_VISIBLE_PLANETS = 10;

export function getPlanetAngle(index: number, total: number) {
  if (total <= 0) return 0;
  const startAngle = -90;
  return startAngle + (360 / total) * index;
}

export function getPlanetLaneRadius(index: number, total: number) {
  if (total <= 4) return index === 0 ? 132 : 136 + index * 16;
  const ring = Math.floor(index / 5);
  const slot = index % 5;
  return ring === 0 ? 132 + slot * 14 : 220 + slot * 16;
}

export function getPlanetSize(index: number, total: number, isOverdue: boolean) {
  if (total <= 4) return index === 0 ? 96 : isOverdue ? 84 : 78;
  if (index === 0) return 84;
  return isOverdue ? 68 : 64;
}
