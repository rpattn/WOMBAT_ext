import type { FileEntry } from './types';

export function scanFiles(fs: Map<string, FileEntry>) {
  const yaml_files: string[] = [];
  const csv_files: string[] = [];
  const html_files: string[] = [];
  const png_files: string[] = [];
  for (const path of fs.keys()) {
    const p = path.toLowerCase();
    if (p.endsWith('.yaml') || p.endsWith('.yml')) yaml_files.push(path);
    else if (p.endsWith('.csv')) csv_files.push(path);
    else if (p.endsWith('.html')) html_files.push(path);
    else if (p.endsWith('.png')) png_files.push(path);
  }
  const total_files = fs.size;
  return { yaml_files, csv_files, html_files, png_files, total_files };
}

export function getConfig(fs: Map<string, FileEntry>) {
  const base = fs.get('project\\config\\base.yaml');
  if (base && base.kind === 'yaml') return base.data;
  return {};
}
