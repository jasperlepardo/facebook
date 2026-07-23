'use client'
import { useState, useEffect } from 'react'
import { Note } from '../types'
import { ALL_TAGS, TAG_LABELS } from '../lib/constants'
import { fmtDateRange } from '../lib/format'

interface Props {
  note: Note | null
  msgIds: string[]
  onClose: () => void
  onSaved: () => void
}

export default function NoteModal({ note, msgIds, onClose, onSaved }: Props) {
  const [start, setStart]   = useState(note?.start ?? '')
  const [end, setEnd]       = useState(note?.end ?? '')
  const [title, setTitle]   = useState(note?.title ?? '')
  const [body, setBody]     = useState(note?.body ?? '')
  const [tags, setTags]     = useState<string[]>(note?.tags ?? [])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStart(note?.start ?? '')
    setEnd(note?.end ?? '')
    setTitle(note?.title ?? '')
    setBody(note?.body ?? '')
    setTags(note?.tags ?? [])
  }, [note])

  const toggleTag = (t: string) =>
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  async function save() {
    setSaving(true)
    const payload = { start, end: end || null, title, body, tags, msgIds: msgIds.length ? msgIds.join(',') : null }
    try {
      if (note) await fetch(`/api/notes/${note.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      else       await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      onSaved()
      onClose()
    } catch { alert('Save failed') }
    finally { setSaving(false) }
  }

  async function del() {
    if (!note || !confirm('Delete this note?')) return
    try {
      await fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
      onSaved()
      onClose()
    } catch { alert('Delete failed') }
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="mb-3">
      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-[.4px] mb-1">{label}</label>
      {children}
    </div>
  )

  const inputCls = "w-full px-2.5 py-1.5 border border-gray-300 rounded text-[13px] outline-none focus:border-blue-500 transition-colors font-[inherit]"

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative bg-white rounded-xl p-6 w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl">
        <h2 className="text-[15px] font-bold text-gray-900 mb-4">{note ? 'Edit Note' : 'New Note'}</h2>

        {msgIds.length > 0 && (
          <Field label="Linked messages">
            <p className="text-[13px] text-blue-600 py-1">{msgIds.length} message{msgIds.length > 1 ? 's' : ''} linked</p>
          </Field>
        )}

        <Field label="Start">
          <input className={inputCls} value={start} onChange={e => setStart(e.target.value)} placeholder="2016-07-14 or 2016-07-14T13:06" />
        </Field>
        <Field label="End (optional)">
          <input className={inputCls} value={end} onChange={e => setEnd(e.target.value)} placeholder="2016-07-14 or 2016-07-14T23:59" />
        </Field>
        <Field label="Tags">
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {ALL_TAGS.map(t => (
              <span key={t} onClick={() => toggleTag(t)}
                className={`px-2.5 py-0.5 border rounded-full text-[11px] cursor-pointer select-none uppercase tracking-[.3px] transition-all ${tags.includes(t) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}>
                {TAG_LABELS[t]}
              </span>
            ))}
          </div>
        </Field>
        <Field label="Title">
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Body">
          <textarea className={`${inputCls} min-h-[90px] resize-y leading-relaxed`} value={body} onChange={e => setBody(e.target.value)} />
        </Field>

        <div className="flex justify-between items-center mt-4 pt-3.5 border-t border-gray-200">
          {note
            ? <button onClick={del} className="px-3.5 py-1.5 border border-red-500 text-red-500 rounded text-[13px] hover:bg-red-50">Delete</button>
            : <span />
          }
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3.5 py-1.5 border border-gray-300 rounded text-[13px] text-gray-500">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-blue-600 text-white rounded text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
