import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      const { fallback, label } = this.props
      if (fallback) return fallback

      return (
        <div style={{
          padding: '32px 24px', textAlign: 'center',
          border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)',
          background: 'var(--clr-surface)', marginTop: 'var(--space-md)',
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--clr-text)', marginBottom: 4 }}>
            {label || 'Something went wrong'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--clr-text-muted)', marginBottom: 16 }}>
            {this.state.error?.message || 'An unexpected error occurred in this section.'}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ fontSize: 12, padding: '6px 16px', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'var(--clr-bg)', color: 'var(--clr-text)' }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
