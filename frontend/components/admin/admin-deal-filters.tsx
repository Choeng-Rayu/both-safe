import { DEAL_STATUSES } from "@/lib/constants";
import { Select } from "@/components/ui/select";

export function AdminDealFilters({
  action,
  currentStatus,
}: {
  action: string;
  currentStatus?: string;
}) {
  return (
    <form action={action} className="soft-card rounded-lg p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Select name="status" defaultValue={currentStatus ?? ""}>
          <option value="">All statuses</option>
          {DEAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          className="focus-ring min-h-11 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white"
        >
          Filter
        </button>
      </div>
    </form>
  );
}
