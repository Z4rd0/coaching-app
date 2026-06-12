export default function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "var(--green-border)", borderTopColor: "transparent" }}
      />
    </div>
  );
}

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card p-4 space-y-3 ${className}`}>
      <SkeletonLine className="w-1/3 h-2.5" />
      <SkeletonLine className="w-3/4 h-4" />
      <SkeletonLine className="w-1/2 h-2.5" />
    </div>
  );
}
