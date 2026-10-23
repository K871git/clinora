import Spinner from './Spinner'

export default function LoadingButton({
  loading = false,
  disabled = false,
  children,
  className = 'btn-primary',
  spinnerSize = 15,
  onClick,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`${className} btn-with-spinner${loading ? ' btn-is-loading' : ''}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <span className="btn-spinner-wrap" aria-hidden="true">
          <Spinner size={spinnerSize} />
        </span>
      )}
      <span className={loading ? 'btn-label-loading' : ''}>{children}</span>
    </button>
  )
}
