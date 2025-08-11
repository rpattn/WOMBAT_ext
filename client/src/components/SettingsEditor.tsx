import React, { useState } from "react";

type ConfigData = {
  name: string;
  library: string;
  weather: string;
  service_equipment: string[];
  layout: string;
  inflation_rate: number;
  fixed_costs: string;
  workday_start: number;
  workday_end: number;
  start_year: number;
  end_year: number;
  project_capacity: number;
};

interface SettingsProps {
  data: ConfigData;
  onChange?: (updatedData: ConfigData) => void;
}

const Settings: React.FC<SettingsProps> = ({ data, onChange }) => {
  const [config, setConfig] = useState<ConfigData>(data);

  const handleChange = (field: keyof ConfigData, value: any) => {
    const updated = { ...config, [field]: value };
    setConfig(updated);
    onChange?.(updated);
  };

  const handleEquipmentChange = (index: number, value: string) => {
    const updatedList = [...config.service_equipment];
    updatedList[index] = value;
    handleChange("service_equipment", updatedList);
  };

  const addEquipment = () => {
    handleChange("service_equipment", [...config.service_equipment, ""]);
  };

  const removeEquipment = (index: number) => {
    const updatedList = [...config.service_equipment];
    updatedList.splice(index, 1);
    handleChange("service_equipment", updatedList);
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2>YAML Config Editor</h2>

      {Object.entries(config).map(([key, value]) => {
        if (key === "service_equipment") {
          return (
            <div key={key}>
              <label><strong>{key}</strong></label>
              {config.service_equipment.map((item, idx) => (
                <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => handleEquipmentChange(idx, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button onClick={() => removeEquipment(idx)}>Remove</button>
                </div>
              ))}
              <button onClick={addEquipment}>Add Equipment</button>
            </div>
          );
        }

        return (
          <div key={key} style={{ marginBottom: "10px" }}>
            <label><strong>{key}</strong></label>
            <input
              type={typeof value === "number" ? "number" : "text"}
              value={value}
              onChange={(e) =>
                handleChange(key as keyof ConfigData, typeof value === "number" ? Number(e.target.value) : e.target.value)
              }
              style={{ width: "100%" }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default Settings;
