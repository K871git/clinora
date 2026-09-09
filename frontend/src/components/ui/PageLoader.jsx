import Spinner from './Spinner'

export default function PageLoader() {
  return (
    <div className="page-loader" aria-label="Loading" role="status">
      <Spinner size={40} />
    </div>
  )
}
