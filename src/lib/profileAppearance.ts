import type { Profile } from '../types';

const AVATAR_COLOR_PALETTE = [
  '#6366F1',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EF4444',
  '#14B8A6',
];

export function getProfileColor(profile?: Pick<Profile, 'id' | 'name'> | null) {
  if (!profile) return '#94A3B8';
  const normalized = `${profile.id ?? ''}:${profile.name}`.toLowerCase();
  if (normalized.includes('enfield')) return '#6366F1';
  if (normalized.includes('alice')) return '#997EF0';
  if (normalized.includes('benne')) return '#8B5CF6';
  if (normalized.includes('mandy')) return '#10B981';
  if (normalized.includes('silvie')) return '#EC4899';
  if (normalized.includes('claire')) return '#F59E0B';
  if (normalized.includes('shani')) return '#14B8A6';
  if (normalized.includes('alby')) return '#EF4444';
  if (normalized.includes('pamela')) return '#3B82F6';
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLOR_PALETTE[Math.abs(hash) % AVATAR_COLOR_PALETTE.length];
}

export function getProfileSoftColor(profile?: Pick<Profile, 'id' | 'name'> | null) {
  const color = getProfileColor(profile).replace('#', '');
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

export function getProfileBorderColor(profile?: Pick<Profile, 'id' | 'name'> | null) {
  const color = getProfileColor(profile).replace('#', '');
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.32)`;
}

export function getProfileInitials(name?: string | null) {
  if (!name) return '—';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}
