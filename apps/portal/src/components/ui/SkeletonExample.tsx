import { Skeleton, TableSkeleton, CardSkeleton } from './Skeleton'
import { useVMRequestStore } from '../../store/vmRequestStore'
import { useVMStore } from '../../store/vmStore'

// Example: How to use skeleton loading with your stores
export function VMRequestTableExample() {
  const { vmRequests, vmRequestsLoading } = useVMRequestStore()

  if (vmRequestsLoading) {
    return <TableSkeleton rows={8} columns={5} />
  }

  return (
    <div>
      {/* Your actual table content */}
      {vmRequests.map((request: any) => (
        <div key={request.id}>{request.hostname}</div>
      ))}
    </div>
  )
}

// Example: Card skeleton
export function VMCardsExample() {
  const { vms, vmsLoading } = useVMStore()
  
  if (vmsLoading) {
    return <CardSkeleton count={6} />
  }

  return (
    <div>
      {/* Your actual cards */}
      {vms.map((vm: any) => (
        <div key={vm.id}>{vm.hostname}</div>
      ))}
    </div>
  )
}

// Example: Custom skeleton for specific layout
export function CustomSkeletonExample() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      
      {/* Content skeleton */}
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      
      {/* Table skeleton */}
      <TableSkeleton rows={5} columns={4} />
    </div>
  )
}
