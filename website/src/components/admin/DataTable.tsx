"use client";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  keyExtractor: (row: T) => string;
}

export default function DataTable<T>({
  columns,
  data,
  loading,
  emptyMessage = "No data yet.",
  keyExtractor,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-text/30">Loading...</div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-text/30">{emptyMessage}</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="px-4 py-3 text-left text-xs uppercase tracking-widest text-text/40 font-medium"
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              className="border-b border-border-subtle/50 hover:bg-background transition-colors"
            >
              {columns.map((col) => (
                <td key={String(col.key)} className="px-4 py-3 text-text/70">
                  {col.render
                    ? col.render(row)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    : String((row as any)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
