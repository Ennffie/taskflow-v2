export const MAX_VISIBLE_PLANETS = 10;

export function getPlanetAngle(index: number, total: number) {
  if (total <= 0) return 0;
  if (total <= 4) {
    const startAngle = -90;
    return startAngle + (360 / total) * index;
  }
  if (index < 4) {
    const primaryAngles = [-128, -38, 42, 132];
    return primaryAngles[index];
  }
  const secondaryAngles = [-150, -92, -28, 28, 92, 150];
  return secondaryAngles[(index - 4) % secondaryAngles.length];
}

export function getPlanetLaneRadius(index: number, total: number) {
  if (total <= 4) return index === 0 ? 132 : 136 + index * 16;
  if (index < 4) return index === 0 ? 164 : 176;
  return 280;
}

export function getPlanetSize(index: number, total: number, isOverdue: boolean) {
  if (total <= 4) return index === 0 ? 96 : isOverdue ? 84 : 78;
  if (index < 4) return index === 0 ? 102 : isOverdue ? 94 : 90;
  return isOverdue ? 72 : 68;
}
