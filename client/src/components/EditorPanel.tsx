import JsonEditor, { type JsonObject } from './JsonEditor'

export type EditorPanelProps = {
  data: JsonObject
  onChange: (data: JsonObject) => void
  onSave: (data: JsonObject) => void
}

export default function EditorPanel({ data, onChange, onSave }: EditorPanelProps) {
  return (
    <div className="col">
      <div className="editor-wrap">
        <JsonEditor
          data={data}
          onChange={(newData) => onChange(newData as JsonObject)}
          onSave={(newData) => onSave(newData as JsonObject)}
        />
      </div>
    </div>
  )
}
