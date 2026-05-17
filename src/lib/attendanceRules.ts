import type { Profile } from '../types';

export const DEFAULT_LATE_THRESHOLD_MINUTES = 9 * 60 + 45;
export const SY_LATE_THRESHOLD_MINUTES = 9 * 60 + 15;

export function getLateThresholdMinutes(profile?: Profile | null) {
  if (!profile) return DEFAULT_LATE_THRESHOLD_MINUTES;
  const normalizedName = profile.name.trim().toLowerCase();
  const normalizedEmail = profile.email.trim().toLowerCase();
  if (normalizedName.includes('silvie') || normalizedEmail.startsWith('silvie.')) {
    return SY_LATE_THRESHOLD_MINUTES;
  }
  return DEFAULT_LATE_THRESHOLD_MINUTES;
}

export function isLateCheckIn(minutes: number, profile?: Profile | null) {
  return minutes > getLateThresholdMinutes(profile);
}

export function formatThresholdLabel(minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
