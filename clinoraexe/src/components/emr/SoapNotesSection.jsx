import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { getSoapNotes, saveSoapNotes } from '../../services/soapNoteService'

const FIELDS = [
  { key: 'soap_subjective',  label: 'S — Subjective',  placeholder: "Patient's complaints, symptoms, history in their own words…" },
  { key: 'soap_objective',   label: 'O — Objective',   placeholder: 'Examination findings, vitals, investigations…' },
  { key: 'soap_assessment',  label: 'A — Assessment',  placeholder: 'Diagnosis or differential diagnosis…' },
  { key: 'soap_plan',        label: 'P — Plan',        placeholder: 'Treatment plan, medications, follow-up, referrals…' },
]

export default function SoapNotesSection({ visitId }) {
  const [notes,   setNotes]   = useState({ soap_subjective: '', soap_objective: '', soap_assessment: '', soap_plan: '' })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const timerRef = useRef(null)
  const savedRef = useRef(null) // tracks the last-saved snapshot

  useEffect(() => {
    setLoading(true)
    getSoapNotes(visitId)
      .then(data => {
        const snap = {
          soap_subjective: data.soap_subjective || '',
          soap_objective:  data.soap_objective  || '',
          soap_assessment: data.soap_assessment || '',
          soap_plan:       data.soap_plan       || '',
        }
        setNotes(snap)
        savedRef.current = snap
      })
      .catch(() => toast.error('Could not load SOAP notes'))
      .finally(() => setLoading(false))
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [visitId])

  function scheduleAutoSave(nextNotes) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSave(nextNotes), 900)
  }

  function handleChange(key, val) {
    const next = { ...notes, [key]: val }
    setNotes(next)
    scheduleAutoSave(next)
  }

  async function doSave(current) {
    const data = {}
    for (const f of FIELDS) data[f.key] = current[f.key] || null
    setSaving(true)
    try {
      await saveSoapNotes(visitId, data)
      savedRef.current = current
    } catch {
      toast.error('Auto-save failed — check connection')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = savedRef.current && FIELDS.some(f => notes[f.key] !== savedRef.current[f.key])

  if (loading) return <div style={{ padding: '16px 0', color: 'var(--clr-text-muted)', fontSize: 13 }}>Loading SOAP notes…</div>

  return (
    <div>
      <div className="soap-grid">
        {FIELDS.map(f => (
          <div key={f.key} className="soap-field">
            <label>{f.label}</label>
            <textarea
              value={notes[f.key]}
              onChange={e => handleChange(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          </div>
        ))}
      </div>
      <div className="soap-save-row">
        <span style={{ fontSize: 11.5, color: 'var(--clr-text-muted)', alignSelf: 'center' }}>
          {saving ? 'Saving…' : isDirty ? 'Unsaved changes' : 'Auto-saved'}
        </span>
      </div>
    </div>
  )
}
