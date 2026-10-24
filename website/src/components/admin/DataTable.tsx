"use client";

import { Empty, Loading } from "./ui";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptySub?: string;
  keyExtractor: (row: T) => string;
}

// Rows read like DLS list items: hairlines between rows only, first column in Body Strong.
export default function DataTable<T>({
  columns,
  data,
  loading,
  emptyMessage = "Nothing here yet.",
  emptySub,
  keyExtractor,
}: DataTableProps<T>) {
  if (loading) return <Loading />;
  if (data.length === 0) return <Empty title={emptyMessage} sub={emptySub} />;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={keyExtractor(row)}>
              {columns.map((col, i) => (
                <td key={col.key} className={i === 0 ? "strong" : undefined}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
