import { useState, useEffect } from 'react'

const PAGE_SIZES = {
  a4:      'A4',
  a5:      'A5',
  letter:  'Letter',
  legal:   'Legal',
  thermal: '80mm auto',
}

const DOC_VARIANTS = {
  a4:      'a4',
  a5:      'a5',
  letter:  'a4',
  legal:   'a4',
  thermal: 'thermal',
}

const STYLE_ID = 'clinora-print-settings'

export default function usePrintSettings(defaultPaper = 'a4') {
  const [paper,       setPaper]       = useState(defaultPaper)
  const [orientation, setOrientation] = useState('portrait')
  const [margin,      setMargin]      = useState('15mm')
  const [scale,       setScale]       = useState('1')

  useEffect(() => {
    let el = document.getElementById(STYLE_ID)
    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ID
      document.head.appendChild(el)
    }

    const baseSize = PAGE_SIZES[paper] ?? 'A4'
    const pageSize = paper === 'thermal' || orientation === 'portrait'
      ? baseSize
      : `${baseSize} landscape`

    let css = `@page { size: ${pageSize}; margin: ${margin}; }`
    if (scale !== '1') {
      css += `\n@media print { html { zoom: ${scale}; } }`
    }

    el.textContent = css

    return () => {
      const existing = document.getElementById(STYLE_ID)
      if (existing) existing.remove()
    }
  }, [paper, orientation, margin, scale])

  return {
    paper, setPaper,
    orientation, setOrientation,
    margin, setMargin,
    scale, setScale,
    docVariant: DOC_VARIANTS[paper] ?? 'a4',
  }
}
