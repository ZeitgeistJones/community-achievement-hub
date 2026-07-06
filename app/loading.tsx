export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded bg-white/10" />
      <div className="h-4 w-96 rounded bg-white/5" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
