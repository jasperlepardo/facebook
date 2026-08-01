export default function ThreadAvatar({
  color, initials, size = 'sm',
}: {
  color: string
  initials: string
  size?: 'sm' | 'lg'
}) {
  const dims = size === 'lg'
    ? 'w-20 h-20 text-2xl font-bold'
    : 'w-8 h-8 text-sm font-black'
  return (
    <div className={`${dims} rounded-full flex items-center justify-center shrink-0 text-white select-none ${color}`}>
      {initials}
    </div>
  )
}
