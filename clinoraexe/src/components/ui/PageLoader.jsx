import { SkeletonTable } from './Skeleton'

export default function PageLoader({ card = true }) {
  return (
    <div className={`page-loader-skeleton${card ? ' card p-4' : ''}`} aria-label="Loading" role="status" aria-live="polite">
      <SkeletonTable rows={7} cols={4} />
    </div>
  )
}
