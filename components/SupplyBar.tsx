export function SupplyBar({
  claimCount,
  maxSupply,
  capLocked,
}: {
  claimCount: bigint;
  maxSupply: bigint;
  capLocked?: boolean;
}) {
  const claimed = Number(claimCount);
  const max = Number(maxSupply);
  const pct = max > 0 ? Math.min(100, (claimed / max) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-text/70">
        <span>
          {claimed} of {max} claimed
        </span>
        {capLocked && <span title="Capped forever">🔒</span>}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-legendary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
