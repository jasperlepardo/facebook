export default function ThreadAvatar({ color, initials }: { color: string; initials: string }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-black text-sm text-white select-none ${color}`}>
      {initials}
    </div>
  )
}
