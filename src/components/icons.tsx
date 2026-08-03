type IconProps = { size?: number; className?: string }

function Svg({ size = 14, className = '', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  )
}

export function LockIcon({ size = 12, className = '' }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2.5" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth="2.5" />
    </Svg>
  )
}

export function GlobeIcon({ size = 12, className = '' }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Svg>
  )
}

export function SelectIcon({ size = 14, className = '' }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  )
}

export function GoToMessageIcon({ size = 14, className = '' }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </Svg>
  )
}

export function GoToGalleryIcon({ size = 14, className = '' }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Svg>
  )
}

export function TagIcon({ size = 14, className = '' }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </Svg>
  )
}

export function CopyLinkIcon({ size = 14, className = '' }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  )
}

export function CopyTextIcon({ size = 14, className = '' }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  )
}

export function HideIcon({ size = 14, className = '' }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </Svg>
  )
}

export function UnhideIcon({ size = 14, className = '' }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  )
}

export function RemoveIcon({ size = 14, className = '' }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  )
}
