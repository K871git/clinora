import { useState, useEffect } from 'react'
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
  const [dirty,   setDirty]   = useState(false)

  useEffect(() => {
    setLoading(true)
    getSoapNotes(visitId)
      .then(data => {
        setNotes({
          soap_subjective: data.soap_subjective || '',
          soap_objective:  data.soap_objective  || '',
          soap_assessment: data.soap_assessment || '',
          soap_plan:       data.soap_plan       || '',
        })
        setDirty(false)
      })
      .catch(() => toast.error('Could not load SOAP notes'))
      .finally(() => setLoading(false))
  }, [visitId])

  function handleChange(key, val) {
    setNotes(n => ({ ...n, [key]: val }))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const data = {}
      for (const f of FIELDS) data[f.key] = notes[f.key] || null
      await saveSoapNotes(visitId, data)
      setDirty(false)
      toast.success('SOAP notes saved')
    } catch (e) {
      toast.error(typeof e === 'string' ? e : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

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
        {dirty && <span style={{ fontSize: 12, color: 'var(--clr-text-muted)', alignSelf: 'center' }}>Unsaved changes</span>}
        <button className="btn-primary" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save SOAP Notes'}
        </button>
      </div>
    </div>
  )
}
