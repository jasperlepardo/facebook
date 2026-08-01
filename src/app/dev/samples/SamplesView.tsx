'use client'
import { useState } from 'react'
import { Message, MessageBlock, LightboxState } from '@/types'
import MessageGroup from '@/components/message/MessageGroup'
import Lightbox from '@/components/Lightbox'
import { ME } from '@/lib/constants'

function toBlock(msg: Message): MessageBlock {
  return {
    date: new Date(msg.timestamp_ms).toLocaleDateString(),
    newDate: true,
    sender: msg.sender_name,
    mine: msg.sender_name === ME,
    msgs: [msg],
  }
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-mist-400 dark:text-mist-500 liquid-glass-bar">
        {label}
      </div>
      {children}
    </div>
  )
}

interface Props {
  samples: { label: string; msg: Message }[]
}

export default function SamplesView({ samples }: Props) {
  const noop = () => {}
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  return (
    <>
      <div className="flex flex-col divide-y divide-mist-100 dark:divide-mist-800">
        {samples.map(({ label, msg }) => (
          <Section key={label} label={label}>
            <MessageGroup
              block={toBlock(msg)}
              onToggle={noop}
              onLightbox={setLightbox}
            />
          </Section>
        ))}
      </div>
      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
    </>
  )
}
