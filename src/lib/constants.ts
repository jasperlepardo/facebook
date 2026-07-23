export const ME = 'Jasper Lepardo'
export const R2 = 'https://pub-bcf374add91945839b65e3ee37ef410d.r2.dev'
export const LIMIT = 80
export const GLIMIT = 60
export const MAX_DOM = LIMIT * 2
export const LOAD_THRESHOLD = 500

export const TAG_COLORS: Record<string, string> = {
  milestone: '#1d4ed8', religion: '#6d28d9', jealousy: '#c2410c',
  conflict: '#b91c1c', pattern: '#9d174d', foreshadowing: '#854d0e',
  travel: '#15803d', money: '#b45309', friendship: '#0f766e',
  social: '#0369a1', work: '#475569', 'wedding-planning': '#be185d',
  'first-contact': '#1e40af', 'first-date': '#1e40af', 'getting-to-know': '#166534',
}

export const TAG_LABELS: Record<string, string> = {
  milestone: 'Milestone', religion: 'Religion', jealousy: 'Jealousy',
  conflict: 'Conflict', pattern: 'Pattern', foreshadowing: 'Foreshadowing',
  travel: 'Travel', money: 'Money', friendship: 'Friendship', social: 'Social',
  work: 'Work', 'wedding-planning': 'Wedding', 'first-contact': 'First Contact',
  'first-date': 'First Date', 'getting-to-know': 'Getting to Know',
}

export const ALL_TAGS = Object.keys(TAG_LABELS)
