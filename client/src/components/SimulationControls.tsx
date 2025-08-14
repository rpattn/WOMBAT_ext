
type Props = {
  onRun: () => void;
  onGetConfig: () => void;
  onClearTemp: () => void;
  onGetLibraryFiles: () => void;
};

export default function SimulationControls({ onRun, onGetConfig, onClearTemp, onGetLibraryFiles }: Props) {
  return (
    <div className="section">
      <h3 className="section-title">Simulation Controls</h3>
      <div className="controls">
        <button onClick={onRun} className="btn-app btn-primary">
          🚀 Run Simulation
        </button>
        <button onClick={onGetConfig} className="btn-app btn-secondary">
          📋 Get Config
        </button>
        <button onClick={onClearTemp} className="btn-app btn-danger">
          🗑️ Clear Temp
        </button>
        <button onClick={onGetLibraryFiles} className="btn-app btn-danger">
          📋 Get Library Files
        </button>
      </div>
    </div>
  );
}
