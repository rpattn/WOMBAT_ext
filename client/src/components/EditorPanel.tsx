import JsonEditor, { type JsonObject } from './JsonEditor'
import { useEffect, useState } from 'react'
import { useApiContext } from '../context/ApiContext'

export type EditorPanelProps = {
  data: JsonObject
  onChange: (data: JsonObject) => void
  onSave: (data: JsonObject) => void
}

export default function EditorPanel({ data, onChange, onSave }: EditorPanelProps) {
  const { selectedFile, getSchema, listSchemas } = useApiContext()
  const [schema, setSchema] = useState<any | null>(null)
  const [schemaOverride, setSchemaOverride] = useState<string>('')
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([])

  // Load available schemas once
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const arr = await listSchemas()
        if (active) setAvailableSchemas(arr)
      } catch {
        if (active) setAvailableSchemas([])
      }
    })()
    return () => { active = false }
  }, [listSchemas])

  useEffect(() => {
    let active = true
    const file = (selectedFile || '').toLowerCase()
    // minimally: fetch configuration schema for YAML files
    if (schemaOverride) {
      // User override takes precedence
      getSchema(schemaOverride)
        .then((s) => { if (active) setSchema(s) })
        .catch(() => { if (active) setSchema(null) })
    } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const isVessel = file.includes('vessels') || file.includes('vessel') || file.includes('service_equipment')
      const isOrbitConfig = file.includes('orbit')
      const isSubstation = file.includes('substation')
      const isTurbine = file.includes('turbine')
      const isCable = file.includes('cable')
      const isPort = (
        file.includes('project/port') ||
        file.includes('project\\port') ||
        (file.includes('project') && file.includes('port'))
      )
      if (isOrbitConfig) {
        // ORBIT project configuration schema
        getSchema('orbit_config')
          .then((s) => { if (active) setSchema(s) })
          .catch(() => { if (active) setSchema(null) })
      } else if (isVessel) {
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
      } else if (isSubstation) {
        // Use dedicated substation schema for substation YAMLs
        getSchema('substation')
          .then((s) => { if (active) setSchema(s) })
          .catch(() => {
            // Fallback: use combined service_equipment schema
            getSchema('service_equipment')
              .then((s) => { if (active) setSchema(s) })
              .catch(() => { if (active) setSchema(null) })
          })
      } else if (isTurbine) {
        // Turbine schema support; prefer wrapper when YAML has top-level capacity/capex or nested turbine object
        const hasWrapper = !!data && typeof data === 'object' && (
          Object.prototype.hasOwnProperty.call(data as any, 'turbine') ||
          Object.prototype.hasOwnProperty.call(data as any, 'capacity_kw') ||
          Object.prototype.hasOwnProperty.call(data as any, 'capex_kw')
        )
        const name = hasWrapper ? 'equipment_turbine' : 'turbine'
        getSchema(name)
          .then((s) => { if (active) setSchema(s) })
          .catch(() => {
            const fallback = hasWrapper ? 'turbine' : 'configuration'
            getSchema(fallback)
              .then((s) => { if (active) setSchema(s) })
              .catch(() => { if (active) setSchema(null) })
          })
      } else if (isCable) {
        // Cable schema support; prefer wrapper when YAML has top-level capacity/capex or nested cable object
        const hasWrapper = !!data && typeof data === 'object' && (
          Object.prototype.hasOwnProperty.call(data as any, 'cable') ||
          Object.prototype.hasOwnProperty.call(data as any, 'capacity_kw') ||
          Object.prototype.hasOwnProperty.call(data as any, 'capex_kw')
        )
        const name = hasWrapper ? 'equipment_cable' : 'cable'
        getSchema(name)
          .then((s) => { if (active) setSchema(s) })
          .catch(() => {
            const fallback = hasWrapper ? 'cable' : 'configuration'
            getSchema(fallback)
              .then((s) => { if (active) setSchema(s) })
              .catch(() => { if (active) setSchema(null) })
          })
      } else if (isPort) {
        getSchema('project_port')
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
  }, [selectedFile, getSchema, schemaOverride])

  return (
    <div className="col">
      <div className="editor-wrap">
        <JsonEditor
          data={data}
          schema={schema || undefined}
          onChange={(newData) => onChange(newData as JsonObject)}
          onSave={(newData) => onSave(newData as JsonObject)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <label htmlFor="schema-override" style={{ fontWeight: 500 }}>Schema</label>
          <select
            id="schema-override"
            value={schemaOverride}
            onChange={(e) => setSchemaOverride(e.target.value)}
          >
            <option value="">Auto (detected)</option>
            {availableSchemas.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
