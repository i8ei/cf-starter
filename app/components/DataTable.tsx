import type { FieldDef, StatusDef } from "@shared/lib/record-def";
import { StatusBadge } from "./StatusBadge";

type Column = {
  key: string;
  label: string;
  field?: FieldDef;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  status,
  onRowClick,
}: {
  columns: Column[];
  rows: T[];
  status?: StatusDef;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-[0.2em] text-slate-400">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-slate-500"
              >
                No records
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={(row.id as number) ?? i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-white/5 ${
                  onRowClick
                    ? "cursor-pointer hover:bg-white/5 transition"
                    : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-slate-200">
                    {status && col.key === status.field ? (
                      <StatusBadge
                        value={String(row[col.key] ?? "")}
                        options={status.options}
                      />
                    ) : (
                      String(row[col.key] ?? "")
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
