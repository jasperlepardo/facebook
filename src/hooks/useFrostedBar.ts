'use client'
import { useEffect, useState, type RefObject } from 'react'

/** Frost chrome when a descendant scroll area under the pane has scrolled. */
export function useFrostedOnScroll(
  rootRef: RefObject<HTMLElement | null>,
  threshold = 1,
) {
  const [frosted, setFrosted] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const pane = root.parentElement ?? root

    const sync = (target?: EventTarget | null) => {
      if (target instanceof HTMLElement && pane.contains(target) && target !== pane) {
        const { overflowY } = getComputedStyle(target)
        if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
          setFrosted(target.scrollTop > threshold)
          return
        }
      }
      let scrolled = false
      pane.querySelectorAll('*').forEach(node => {
        if (scrolled || !(node instanceof HTMLElement)) return
        const { overflowY } = getComputedStyle(node)
        if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
          && node.scrollTop > threshold) {
          scrolled = true
        }
      })
      setFrosted(scrolled)
    }

    const onScroll = (e: Event) => sync(e.target)
    pane.addEventListener('scroll', onScroll, true)
    sync()
    return () => pane.removeEventListener('scroll', onScroll, true)
  }, [rootRef, threshold])

  return frosted
}

/** True while a sticky element is stuck to the top of its scrollport. */
export function useStickyStuck(stickyRef: RefObject<HTMLElement | null>) {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const el = stickyRef.current
    const parent = el?.parentElement
    if (!el || !parent) return

    const sentinel = document.createElement('div')
    sentinel.setAttribute('aria-hidden', 'true')
    sentinel.style.cssText = 'height:1px;width:100%;pointer-events:none;margin:0;padding:0;overflow:hidden'
    parent.insertBefore(sentinel, el)

    let root: Element | null = parent
    while (root && root !== document.documentElement) {
      const { overflowY } = getComputedStyle(root)
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') break
      root = root.parentElement
    }

    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0, root: root instanceof Element && root !== document.documentElement ? root : null },
    )
    observer.observe(sentinel)
    return () => {
      observer.disconnect()
      sentinel.remove()
    }
  }, [stickyRef])

  return stuck
}
