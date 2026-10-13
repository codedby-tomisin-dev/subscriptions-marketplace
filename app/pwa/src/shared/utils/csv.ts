type Cell = string | number | null | undefined;

const escapeCell = (cell: Cell) => {
  const text = cell == null ? "" : String(cell);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Builds a CSV from a header row and data rows and hands it to the browser as a download. */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]): void {
  const csv = [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}
