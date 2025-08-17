import JsonEditor, { type JsonObject } from './JsonEditor'
import { useEffect, useState } from 'react'
import { useApiContext } from '../context/ApiContext'

export type EditorPanelProps = {
  data: JsonObject
  onChange: (data: JsonObject) => void
  onSave: (data: JsonObject) => void
}

export default function EditorPanel({ data, onChange, onSave }: EditorPanelProps) {
  const { selectedFile, getSchema } = useApiContext()
  const [schema, setSchema] = useState<any | null>(null)

  useEffect(() => {
    let active = true
    const file = (selectedFile || '').toLowerCase()
    // minimally: fetch configuration schema for YAML files
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const isVessel = file.includes('vessels') || file.includes('vessel') || file.includes('service_equipment')
      if (isVessel) {
        console.log(data)
        const strategy = (data as any)?.strategy
        const strat = typeof strategy === 'string' ? strategy.toLowerCase() : ''
        const isUnscheduled = strat === 'unscheduled' || strat === 'requests' || strat === 'downtime'
        const schemaName = strat === 'scheduled'
          ? 'service_equipment_scheduled'
          : isUnscheduled
            ? 'service_equipment_unscheduled'
            : 'service_equipment'
        getSchema(schemaName)
          .then((s) => { if (active) setSchema(s) })
          .catch(() => { if (active) setSchema(null) })
      } else {
        getSchema('configuration')
          .then((s) => { if (active) setSchema(s) })
          .catch(() => { if (active) setSchema(null) })
      }
    } else {
      // If no selectedFile yet but data is present (autoloaded base config), fetch configuration schema
      if (data && Object.keys(data || {}).length > 0) {
        getSchema('configuration')
          .then((s) => { if (active) setSchema(s) })
          .catch(() => { if (active) setSchema(null) })
      } else {
        setSchema(null)
      }
    }
    return () => { active = false }
  }, [selectedFile, data, getSchema])

  return (
    <div className="col">
      <div className="editor-wrap">
        <JsonEditor
          data={data}
          schema={schema || undefined}
          onChange={(newData) => onChange(newData as JsonObject)}
          onSave={(newData) => onSave(newData as JsonObject)}
        />
      </div>
    </div>
  )
}
