
type Props = {
  preview: string | null;
  filePath: string;
};

export default function CsvPreview({ preview, filePath }: Props) {
  if (!preview || !filePath.toLowerCase().endsWith('.csv')) return null;
  return (
    <div>
      <h3 className="csv-preview-title">CSV Preview (first 800 chars)</h3>
      <div className="csv-preview" aria-label="CSV preview">
        {preview}
        {preview.length >= 100 && '…'}
      </div>
      <p className="csv-note">Full CSV editing is not supported yet.</p>
    </div>
  );
}
