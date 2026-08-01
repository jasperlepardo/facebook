'use client'

interface AvatarPerson {
  initials: string
  color: string
}

interface Props {
  people: AvatarPerson[]
  size?: 'sm' | 'md' | 'lg'
  /** collage = Messenger stack; row = side-by-side (header). */
  layout?: 'collage' | 'row'
  className?: string
  /** Max faces in row layout before +N (default 4). */
  max?: number
}

const SIZE = {
  sm: { box: 'w-8 h-8',  one: 'w-8 h-8 text-[10px]',  pair: 'w-[1.15rem] h-[1.15rem] text-[7px]',  cell: 'w-3.5 h-3.5 text-[6px]',  row: 'w-7 h-7 text-[10px]',  overlap: '-ml-2' },
  md: { box: 'w-14 h-14', one: 'w-14 h-14 text-xl',    pair: 'w-8 h-8 text-[11px]',               cell: 'w-[1.65rem] h-[1.65rem] text-[9px]', row: 'w-10 h-10 text-xs',   overlap: '-ml-2.5' },
  lg: { box: 'w-20 h-20', one: 'w-20 h-20 text-2xl',   pair: 'w-11 h-11 text-sm',                 cell: 'w-[2.35rem] h-[2.35rem] text-xs', row: 'w-12 h-12 text-sm',  overlap: '-ml-3' },
} as const

function Tile({
  person, className,
}: {
  person: AvatarPerson
  className: string
}) {
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold select-none ring-2 ring-white dark:ring-mist-900 ${person.color} ${className}`}
    >
      {person.initials}
    </div>
  )
}

/** Messenger-style group avatar: collage stack, or side-by-side row. */
export default function AvatarGroup({
  people, size = 'md', layout = 'collage', className = '', max = 4,
}: Props) {
  const s = SIZE[size]
  if (people.length === 0) {
    return (
      <div className={`${s.box} rounded-full bg-mist-200 dark:bg-mist-700 shrink-0 ${className}`} />
    )
  }

  if (layout === 'row') {
    const shown = people.slice(0, max)
    const extra = people.length - shown.length
    return (
      <div className={`flex items-center shrink-0 ${className}`} role="img" aria-label={people.map(p => p.initials).join(', ')}>
        {shown.map((person, i) => (
          <div key={`${person.initials}-${i}`} className={i === 0 ? '' : s.overlap} style={{ zIndex: shown.length - i }}>
            <Tile person={person} className={s.row} />
          </div>
        ))}
        {extra > 0 && (
          <div className={s.overlap} style={{ zIndex: 0 }}>
            <div className={`${s.row} rounded-full flex items-center justify-center bg-mist-300 dark:bg-mist-600 text-white font-bold select-none ring-2 ring-white dark:ring-mist-900`}>
              +{extra}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (people.length === 1) {
    return (
      <div className={`shrink-0 ${className}`}>
        <Tile person={people[0]} className={s.one} />
      </div>
    )
  }

  if (people.length === 2) {
    return (
      <div className={`relative shrink-0 ${s.box} ${className}`}>
        <div className="absolute top-0 left-0">
          <Tile person={people[0]} className={s.pair} />
        </div>
        <div className="absolute bottom-0 right-0">
          <Tile person={people[1]} className={s.pair} />
        </div>
      </div>
    )
  }

  // 3+: 2×2 collage; last cell is +N when more than 4
  const slots: (AvatarPerson | { more: number })[] = people.slice(0, 4)
  if (people.length > 4) {
    slots[3] = { more: people.length - 3 }
  }

  return (
    <div className={`relative shrink-0 ${s.box} ${className}`}>
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5">
        {slots.map((c, i) => (
          'more' in c ? (
            <div
              key={`more-${i}`}
              className={`${s.cell} rounded-full flex items-center justify-center bg-mist-300 dark:bg-mist-600 text-white font-bold select-none`}
            >
              +{c.more}
            </div>
          ) : (
            <div
              key={`${c.initials}-${i}`}
              className={`${s.cell} rounded-full flex items-center justify-center text-white font-bold select-none ${c.color}`}
            >
              {c.initials}
            </div>
          )
        ))}
      </div>
    </div>
  )
}
