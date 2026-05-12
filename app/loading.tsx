export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-6xl items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-4 w-64 animate-pulse rounded bg-white/10" />
        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="h-10 animate-pulse rounded-xl bg-white/10" />
          <div className="h-10 animate-pulse rounded-xl bg-white/10" />
          <div className="h-10 animate-pulse rounded-xl bg-white/10" />
        </div>
      </div>
    </div>
  );
}
