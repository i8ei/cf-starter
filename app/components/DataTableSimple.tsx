interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right";
}

interface DataTableSimpleProps<T> {
  columns: Column<T>[];
  data: T[];
}

/**
 * Lightweight read-only table. Use DataTable for sortable/filterable tables.
 */
export function DataTableSimple<T extends Record<string, unknown>>({
  columns,
  data,
}: DataTableSimpleProps<T>) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2 px-2 font-medium text-muted text-xs ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-surface-hover">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-1.5 px-2 tabular-nums ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.render ? col.render(row) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
