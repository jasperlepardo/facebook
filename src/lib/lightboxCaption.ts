/** Shared lightbox header title for photos/videos/gifs: `date · sender`. */
export function lightboxMediaCaption(ts: number, sender: string) {
  const name = sender.trim()
  const date = new Date(ts).toLocaleDateString()
  return name ? `${date} · ${name}` : date
}
