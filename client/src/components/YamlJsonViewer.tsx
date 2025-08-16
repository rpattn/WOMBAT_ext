import type { JsonObject } from './JsonEditor';
import type { JsonDict } from '../types';

export type YamlJsonViewerProps = {
  // Either a parsed object or a raw string (already YAML/JSON text)
  data: JsonObject | JsonDict | string | null | undefined;
  title?: string;
  defaultOpen?: boolean;
  style?: React.CSSProperties;
};

// Lightweight, read-only tree viewer for YAML/JSON-like data
export default function YamlJsonViewer({ data, title = 'File', defaultOpen = true, style }: YamlJsonViewerProps) {
  if (data == null || (typeof data === 'object' && Object.keys(data as any).length === 0)) {
    return (
      <div className="card" style={{ padding: 16, ...(style || {}) }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p>No content.</p>
      </div>
    );
  }

  // Primitive or string: display as preformatted block
  if (typeof data === 'string') {
    return (
      <div className="card" style={{ padding: 16, ...(style || {}) }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{data}</pre>
      </div>
    );
  }

  // Object or array: render read-only tree
  const renderNode = (keyPath: (string | number)[], value: any) => {
    const id = keyPath.join('.') || 'root';

    if (Array.isArray(value)) {
      return (
        <div key={id} style={{ marginBottom: 8 }}>
          <details open={defaultOpen}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{String(keyPath[keyPath.length - 1] ?? 'root')} [Array]</summary>
            <div style={{ paddingLeft: 12, marginTop: 6 }}>
              {value.length === 0 && <div style={{ opacity: 0.7 }}>(empty)</div>}
              {value.map((item, idx) => (
                <div key={`${id}.${idx}`}>
                  {typeof item === 'object' && item !== null
                    ? renderNode([...keyPath, idx], item)
                    : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6 }}>
                        <div style={{ opacity: 0.8 }}>[{idx}]</div>
                        <div><code>{String(item)}</code></div>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </details>
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value as Record<string, any>);
      return (
        <div key={id} style={{ marginBottom: 8 }}>
          <details open={defaultOpen}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{String(keyPath[keyPath.length - 1] ?? 'root')} [Object]</summary>
            <div style={{ paddingLeft: 12, marginTop: 6 }}>
              {entries.length === 0 && <div style={{ opacity: 0.7 }}>(empty)</div>}
              {entries.map(([k, v]) => (
                <div key={`${id}.${k}`}>
                  {typeof v === 'object' && v !== null
                    ? renderNode([...keyPath, k], v)
                    : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6 }}>
                        <div style={{ opacity: 0.8 }}>{k}</div>
                        <div><code>{String(v)}</code></div>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </details>
        </div>
      );
    }

    // Primitive value at root (unlikely when data is object)
    return (
      <div key={id} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6 }}>
        <div style={{ opacity: 0.8 }}>{String(keyPath[keyPath.length - 1] ?? 'value')}</div>
        <div><code>{String(value)}</code></div>
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: 16, ...(style || {}) }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div>
        {renderNode([], data)}
      </div>
    </div>
  );
}
