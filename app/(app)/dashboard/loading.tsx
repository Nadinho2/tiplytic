export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card/70 p-6">
        <div className="h-6 w-56 animate-pulse rounded bg-white/10" />
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-20 animate-pulse rounded-2xl border border-border bg-white/5"
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl border border-border bg-card/50" />
        <div className="h-80 animate-pulse rounded-2xl border border-border bg-card/50" />
      </div>
    </div>
  );
}
