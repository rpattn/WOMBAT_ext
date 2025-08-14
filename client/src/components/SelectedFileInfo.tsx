
type Props = {
  selectedFile: string;
};

export default function SelectedFileInfo({ selectedFile }: Props) {
  if (!selectedFile) {
    return <p>No file selected</p>;
  }
  const isYaml = selectedFile.endsWith('.yaml') || selectedFile.endsWith('.yml');
  const type = isYaml ? 'YAML' : 'CSV';
  const fileName = (selectedFile.split(/[/\\]/).pop() || selectedFile);
  return (
    <div>
      <p><strong>Selected File:</strong> {fileName}</p>
      <p><strong>Type:</strong> {type}</p>
      <p><strong>Path:</strong> {selectedFile}</p>
    </div>
  );
}
