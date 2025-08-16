import React, { useMemo, useState } from 'react';

type Props = {
  preview: string | null;
  filePath: string;
};

// Detect delimiter from the first non-empty line, counting only delimiters outside quotes
function detectDelimiter(text: string): ',' | ';' | '\t' | '|' {
  const firstLine = (text.split(/\r?\n/).find(l => l.trim().length > 0) ?? '');
  const candidates: Array<',' | ';' | '\t' | '|'> = [',', ';', '\t', '|'];
  let best: { delim: ',' | ';' | '\t' | '|'; count: number } = { delim: ',', count: -1 };
  for (const cand of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') {
        // handle doubled quotes inside quoted field
        if (inQuotes && i + 1 < firstLine.length && firstLine[i + 1] === '"') { i++; continue; }
        inQuotes = !inQuotes;
      } else if (!inQuotes) {
        if (cand === '\t') {
          if (ch === '\t') count++;
        } else if (ch === cand) {
          count++;
        }
      }
    }
    if (count > best.count) best = { delim: cand, count };
  }
  return best.delim;
}

// Basic CSV parser with quote handling (RFC4180-ish)
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  const len = text.length;
  const d = delimiter === '\t' ? '\t' : delimiter;
  while (i < len) {
    const ch = text[i];
    if (ch === '"') {
      // quoted field
      i++; // skip opening quote
      while (i < len) {
        const c = text[i];
        if (c === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2; // escaped quote
          } else {
            i++; // closing quote
            break;
          }
        } else {
          field += c;
          i++;
        }
      }
      // after closing quote, expect delimiter or newline or EOF
      if (i < len) {
        if (text[i] === d) {
          row.push(field);
          field = '';
          i++; // consume delimiter
          continue;
        }
        if (text[i] === '\r') {
          i++;
          if (i < len && text[i] === '\n') i++;
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
          continue;
        }
        if (text[i] === '\n') {
          i++;
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
          continue;
        }
        if (text[i] === ' ') {
          // allow trailing spaces before delimiter/newline
          while (i < len && text[i] === ' ') i++;
          continue;
        }
      }
    } else if (ch === d) {
      row.push(field);
      field = '';
      i++;
      continue;
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    } else if (ch === '\r') {
      i++;
      if (i < len && text[i] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    } else {
      field += ch;
      i++;
    }
  }
  // flush
  row.push(field);
  rows.push(row);
  // Trim any trailing empty last row if the file ended with newline
  if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

export default function CsvPreview({ preview, filePath }: Props) {
  const isCsv = !!filePath && filePath.toLowerCase().endsWith('.csv');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<{ index: number; dir: 'asc' | 'desc' } | null>(null);

  // Reset paging when preview changes
  React.useEffect(() => {
    setPage(1);
    setQuery('');
    setSort(null);
  }, [preview, filePath]);

  // Avoid conditional hooks by always computing with safe text
  // Strip BOM if present to avoid polluting first cell
  const text = (preview ?? '').replace(/^\uFEFF/, '');
  const delimiter = useMemo(() => detectDelimiter(text), [text]);
  const rows = useMemo(() => parseCsv(text, delimiter), [text, delimiter]);
  // Fallback: if parser returns a single row but there are multiple newlines,
  // fall back to a naive split (handles some edge cases with unusual quoting)
  const effectiveRows = useMemo(() => {
    if (rows.length <= 1) {
      const lineSplit = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lineSplit.length > 1) {
        const naive = lineSplit.map(l => (delimiter === '\t' ? l.split('\t') : l.split(delimiter)));
        if (naive.length > 1) return naive;
      }
      // Handle files where rows were concatenated with spaces instead of newlines
      const parts = text.split(/\s+/).filter(p => p.length > 0);
      if (parts.length > 1) {
        const segmented = parts.map(p => (delimiter === '\t' ? p.split('\t') : p.split(delimiter)));
        const counts = segmented.map(r => r.length).filter(c => c > 1);
        if (counts.length > 1) {
          const firstCount = counts[0];
          const consistent = counts.every(c => c === firstCount);
          if (consistent) return segmented;
        }
      }
    }
    return rows;
  }, [rows, text, delimiter]);

  // Determine max number of columns across a sample of rows
  const maxCols = useMemo(() => {
    let m = 0;
    for (let i = 0; i < Math.min(effectiveRows.length, 200); i++) {
      m = Math.max(m, effectiveRows[i]?.length ?? 0);
    }
    return m;
  }, [effectiveRows]);

  const headers = useMemo(() => {
    if (effectiveRows.length === 0) return [] as string[];
    const first = effectiveRows[0] ?? [];
    const second = effectiveRows[1] ?? [];
    const nonNumRatio = (arr: string[]) => {
      if (!arr || arr.length === 0) return 0;
      let non = 0;
      for (const v of arr) {
        const s = (v ?? '').toString().trim();
        if (s === '') { non++; continue; }
        const n = Number(s);
        if (Number.isNaN(n)) non++;
      }
      return non / arr.length;
    };
    const alphaRatio = (arr: string[]) => {
      if (!arr || arr.length === 0) return 0;
      let alpha = 0;
      for (const v of arr) {
        const s = (v ?? '').toString();
        if (/[A-Za-z]/.test(s)) alpha++;
      }
      return alpha / arr.length;
    };
    const hasSecond = effectiveRows.length > 1;
    // Stricter header detection to avoid dropping data rows incorrectly
    const areHeaders = hasSecond && (
      nonNumRatio(first) > nonNumRatio(second) || alphaRatio(first) > alphaRatio(second)
    );
    const colsCount = Math.max(maxCols, areHeaders ? first.length : first.length);
    const cols: string[] = [];
    for (let i = 0; i < colsCount; i++) {
      const label = areHeaders ? (first[i]?.trim()?.length ? first[i] : `Column ${i + 1}`) : `Column ${i + 1}`;
      cols.push(label);
    }
    return cols;
  }, [effectiveRows, maxCols]);

  const dataRows = useMemo(() => {
    if (effectiveRows.length === 0) return [] as string[][];
    const first = effectiveRows[0] ?? [];
    const second = effectiveRows[1] ?? [];
    const nonNumRatio = (arr: string[]) => {
      if (!arr || arr.length === 0) return 0;
      let non = 0;
      for (const v of arr) {
        const s = (v ?? '').toString().trim();
        if (s === '') { non++; continue; }
        const n = Number(s);
        if (Number.isNaN(n)) non++;
      }
      return non / arr.length;
    };
    const alphaRatio = (arr: string[]) => {
      if (!arr || arr.length === 0) return 0;
      let alpha = 0;
      for (const v of arr) {
        const s = (v ?? '').toString();
        if (/[A-Za-z]/.test(s)) alpha++;
      }
      return alpha / arr.length;
    };
    const areHeaders = effectiveRows.length > 1 && (
      nonNumRatio(first) > nonNumRatio(second) || alphaRatio(first) > alphaRatio(second)
    );
    return areHeaders ? effectiveRows.slice(1) : effectiveRows;
  }, [effectiveRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dataRows;
    return dataRows.filter(r => r.some(c => (c ?? '').toString().toLowerCase().includes(q)));
  }, [dataRows, query]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const { index, dir } = sort;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[index] ?? '';
      const bv = b[index] ?? '';
      const an = Number(av);
      const bn = Number(bv);
      const bothNum = !isNaN(an) && !isNaN(bn);
      const cmp = bothNum ? an - bn : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sort]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = sorted.slice(start, end);

  const onHeaderClick = (idx: number) => {
    setSort(prev => {
      if (!prev || prev.index !== idx) return { index: idx, dir: 'asc' };
      if (prev.dir === 'asc') return { index: idx, dir: 'desc' };
      return null; // third click removes sort
    });
  };

  // After hooks are declared, it's safe to conditionally render nothing
  if (!isCsv || text.trim() === '') return null;

  return (
    <div className="csv-viewer">
      <div className="row csv-toolbar">
        <h3 className="csv-title">CSV Viewer</h3>
        <span className="csv-stat">Delimiter: {delimiter === '\t' ? 'Tab' : delimiter}</span>
        <span className="csv-stat-dim">· parsed rows: {effectiveRows.length} · cols: {headers.length}</span>
      </div>

      <div className="row csv-controls">
        <input
          className="csv-filter"
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
          placeholder="Filter rows..."
          aria-label="Filter rows"
        />
        <label className="csv-label">Rows per page</label>
        <select className="csv-page-size" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
          {[25, 50, 100, 200, 500].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="csv-pagination">
          <button className="btn" onClick={() => setPage(1)} disabled={currentPage === 1}>{'<<'}</button>
          <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{'<'}</button>
          <span className="csv-page-info">Page {currentPage} / {totalPages} · {total} rows</span>
          <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>{'>'}</button>
          <button className="btn" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages}>{'>>'}</button>
        </div>
      </div>

      <div className="csv-table-wrap">
        <table className="csv-table">
          <thead>
            <tr>
              {headers.map((h, i) => {
                const isSorted = sort?.index === i;
                const arrow = isSorted ? (sort?.dir === 'asc' ? ' ▲' : ' ▼') : '';
                return (
                  <th
                    key={i}
                    onClick={() => onHeaderClick(i)}
                    className="csv-th"
                    title="Click to sort"
                  >{h}{arrow}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className="csv-empty" colSpan={Math.max(1, headers.length)}>No rows</td>
              </tr>
            ) : (
              pageRows.map((r, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td key={ci} className="csv-td">
                      {r[ci] ?? ''}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="row csv-controls csv-controls-bottom">
        <button className="btn" onClick={() => setPage(1)} disabled={currentPage === 1}>{'<<'}</button>
        <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{'<'}</button>
        <span className="csv-page-info">Page {currentPage} / {totalPages} · {total} rows</span>
        <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>{'>'}</button>
        <button className="btn" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages}>{'>>'}</button>
      </div>
      <p className="csv-note">Editing CSV is not supported yet. Use Replace to upload a modified file.</p>
    </div>
  );
}
