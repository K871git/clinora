const MARGIN_OPTIONS = [
  { label: 'None (0)',       value: '0' },
  { label: 'Compact (6mm)',  value: '6mm' },
  { label: 'Normal (15mm)',  value: '15mm' },
  { label: 'Wide (25mm)',    value: '25mm' },
]

const SCALE_OPTIONS = [
  { label: '100%', value: '1' },
  { label: '95%',  value: '0.95' },
  { label: '90%',  value: '0.9' },
  { label: '85%',  value: '0.85' },
  { label: '80%',  value: '0.8' },
  { label: '75%',  value: '0.75' },
]

const ORIENTATION_OPTIONS = [
  { label: 'Portrait',  value: 'portrait' },
  { label: 'Landscape', value: 'landscape' },
]

export default function PrintSettingsPanel({
  papers,
  paper, setPaper,
  orientation, setOrientation,
  margin, setMargin,
  scale, setScale,
}) {
  return (
    <div className="inv-settings-panel">

      <div className="inv-settings-group">
        <span className="inv-settings-label">Paper</span>
        <select className="inv-settings-select" value={paper} onChange={e => setPaper(e.target.value)}>
          {papers.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {paper !== 'thermal' && (
        <>
          <div className="inv-settings-div" />
          <div className="inv-settings-group">
            <span className="inv-settings-label">Orientation</span>
            <select className="inv-settings-select" value={orientation} onChange={e => setOrientation(e.target.value)}>
              {ORIENTATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </>
      )}

      <div className="inv-settings-div" />

      <div className="inv-settings-group">
        <span className="inv-settings-label">Margins</span>
        <select className="inv-settings-select" value={margin} onChange={e => setMargin(e.target.value)}>
          {MARGIN_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="inv-settings-div" />

      <div className="inv-settings-group">
        <span className="inv-settings-label">Scale</span>
        <select className="inv-settings-select" value={scale} onChange={e => setScale(e.target.value)}>
          {SCALE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

    </div>
  )
}
