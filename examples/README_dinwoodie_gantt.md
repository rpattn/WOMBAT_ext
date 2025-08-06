# DINWOODIE Maintenance Gantt Chart Generator

This project provides scripts to run the DINWOODIE wind farm simulation and create Gantt charts showing maintenance requests over time.

## Files

- `dinwoodie_gantt_chart.py` - Standalone Python script
- `dinwoodie_gantt_chart.ipynb` - Jupyter notebook version
- `README_dinwoodie_gantt.md` - This documentation file

## Requirements

Make sure you have WOMBAT installed and the DINWOODIE library available. The scripts require:

- Python 3.8+
- WOMBAT library
- pandas
- matplotlib
- numpy

## Usage

### Option 1: Python Script

Run the standalone Python script:

```bash
python dinwoodie_gantt_chart.py
```

This will:
1. Run the DINWOODIE simulation with the base configuration
2. Extract maintenance request data
3. Print summary statistics
4. Create two Gantt charts:
   - `dinwoodie_maintenance_gantt.png` - Timeline of maintenance requests
   - `dinwoodie_detailed_gantt.png` - Duration of completed maintenance tasks

### Option 2: Jupyter Notebook

Open the Jupyter notebook for interactive analysis:

```bash
jupyter notebook dinwoodie_gantt_chart.ipynb
```

The notebook provides:
- Step-by-step execution
- Interactive plots
- Detailed analysis
- Additional monthly pattern analysis

## Output

The scripts generate:

1. **Summary Statistics**: Console output showing:
   - Total number of maintenance requests
   - Breakdown by request type (maintenance vs repair)
   - Top components requiring attention
   - Time range of simulation
   - Monthly request patterns

2. **Gantt Chart 1 - Timeline**: Shows when different types of maintenance were requested over time
   - Blue bars: Maintenance requests
   - Red bars: Repair requests
   - X-axis: Time (simulation period)
   - Y-axis: Different maintenance tasks

3. **Gantt Chart 2 - Task Durations**: Shows the duration of completed maintenance tasks
   - Bar length represents time from request to completion
   - Includes task descriptions and duration in days
   - Only shows completed tasks (not ongoing or canceled)

4. **Monthly Pattern Analysis** (notebook only): Bar chart showing monthly distribution of requests by type

## Configuration

The script uses the "base" configuration from the DINWOODIE library. To use a different configuration:

1. **Python Script**: Modify the `config_name` parameter in the `run_dinwoodie_simulation()` function call
2. **Notebook**: Change the configuration name in the simulation cell

Available configurations include:
- `base` - Standard configuration
- `more_ctvs` - More crew transfer vessels
- `fewer_ctvs` - Fewer crew transfer vessels
- `more_techs` - More technicians
- `fewer_techs` - Fewer technicians
- `failure_50` - 50% failure rate
- `failure_200` - 200% failure rate
- `no_hlvs` - No heavy lift vessels
- `annual_service_only` - Only annual service maintenance

## Understanding the Results

### Maintenance vs Repair Requests
- **Maintenance Requests**: Scheduled/preventive maintenance activities
- **Repair Requests**: Unscheduled repairs due to failures

### Task Descriptions
Tasks are labeled as "Component - Reason" where:
- Component: The wind farm component (e.g., "gearbox", "generator")
- Reason: The specific maintenance or repair reason

### Duration Analysis
The detailed Gantt chart shows:
- How long tasks took from request to completion
- Which components had the longest repair times
- Seasonal patterns in maintenance activities

## Customization

To modify the analysis:

1. **Change Configuration**: Use different DINWOODIE configurations
2. **Filter Data**: Modify the filtering criteria in `extract_maintenance_requests()`
3. **Custom Plots**: Modify the plotting functions to show different aspects
4. **Add Analysis**: Extend the notebook with additional analysis

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure WOMBAT is properly installed
2. **Missing Data**: Some configurations may have no maintenance requests
3. **Memory Issues**: Large simulations may require more memory
4. **Plot Display**: Ensure matplotlib backend is properly configured

### Debugging

- Check the console output for error messages
- Verify the DINWOODIE library path
- Ensure the configuration file exists
- Check that the simulation completes successfully

## Example Output

```
DINWOODIE Maintenance Gantt Chart Generator
==================================================
Running DINWOODIE simulation with config: base
Simulation completed: dinwoodie_base

============================================================
MAINTENANCE REQUEST SUMMARY
============================================================
Total maintenance requests: 245

Requests by type:
  Maintenance: 180
  Repair: 65

Requests by component:
  gearbox: 45
  generator: 38
  blade: 32
  ...

Simulation time range: 2003-01-01 to 2012-12-31

Average requests per month: 2.0
Peak month: 2005-06 with 8 requests

Gantt chart saved as: dinwoodie_maintenance_gantt.png
Detailed Gantt chart saved as: dinwoodie_detailed_gantt.png
```

## Contributing

To extend this analysis:

1. Add new plotting functions
2. Include additional statistical analysis
3. Support for other simulation configurations
4. Export data to other formats
5. Add interactive features

## License

This project follows the same license as the WOMBAT library. 