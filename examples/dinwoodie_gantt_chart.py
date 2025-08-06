#!/usr/bin/env python3
"""
DINWOODIE Simulation Gantt Chart Generator

This script runs the DINWOODIE simulation and creates a Gantt chart showing
maintenance requests over time.
"""

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import numpy as np

from wombat import Simulation
from wombat.core.library import DINWOODIE


def run_dinwoodie_simulation(config_name="base"):
    """
    Run the DINWOODIE simulation with the specified configuration.
    
    Parameters
    ----------
    config_name : str
        Name of the configuration file (without .yaml extension)
        
    Returns
    -------
    Simulation
        The completed simulation object
    """
    print(f"Running DINWOODIE simulation with config: {config_name}")
    
    # Create and run the simulation
    sim = Simulation(DINWOODIE, f"{config_name}.yaml", random_seed=2023)
    sim.run()
    
    print(f"Simulation completed: {sim.config.name}")
    return sim


def extract_maintenance_requests(sim):
    """
    Extract maintenance request data from the simulation results.
    
    Parameters
    ----------
    sim : Simulation
        The completed simulation object
        
    Returns
    -------
    pd.DataFrame
        DataFrame containing maintenance request information
    """
    # Get events data
    events = sim.metrics.events
    
    # Filter for maintenance and repair requests
    maintenance_events = events[
        events['action'].isin(['maintenance request', 'repair request'])
    ].copy()
    
    # Convert simulation time to datetime
    maintenance_events['datetime'] = pd.to_datetime(
        maintenance_events['env_datetime']
    )
    
    # Create a more readable task description
    maintenance_events['task_description'] = (
        maintenance_events['part_name'] + ' - ' + 
        maintenance_events['reason']
    )
    
    # Add request type (maintenance vs repair)
    maintenance_events['request_type'] = maintenance_events['action'].str.replace(
        ' request', ''
    )
    
    return maintenance_events


def create_gantt_chart(maintenance_data, output_file="dinwoodie_maintenance_gantt.png"):
    """
    Create a Gantt chart of maintenance requests.
    
    Parameters
    ----------
    maintenance_data : pd.DataFrame
        DataFrame containing maintenance request information
    output_file : str
        Output filename for the Gantt chart
    """
    if maintenance_data.empty:
        print("No maintenance requests found in simulation data.")
        return
    
    # Sort by datetime to show all requests in chronological order
    timeline_data = maintenance_data['datetime']
    
    # Create the figure - adjust height based on number of requests
    fig, ax = plt.subplots(figsize=(15, max(8, len(timeline_data) * 0.3)))
    
    # Color mapping for request types
    colors = {'maintenance': '#2E86AB', 'repair': '#A23B72'}
    
    # Create horizontal bars for each maintenance request
    y_positions = range(len(timeline_data))
    
    for i, (idx, row) in enumerate(maintenance_data.iterrows()):
        color = colors.get(row['request_type'], '#6C757D')
        
        # Create a small bar at the request time
        ax.barh(i, timedelta(hours=1), left=row['datetime'], 
                height=0.6, color=color, alpha=0.8)
        
        # Add text label with request number for clarity
        label_text = f"{row['task_description']} (#{i+1})"
        ax.text(row['datetime'] + timedelta(hours=2), i, 
                label_text, va='center', fontsize=8)
    
    # Customize the plot
    ax.set_yticks(y_positions)
    ax.set_yticklabels([])  # No y-axis labels for cleaner look
    
    # Format x-axis
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=6))
    ax.xaxis.set_minor_locator(mdates.MonthLocator(interval=1))
    
    # Rotate x-axis labels
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    # Add title and labels
    ax.set_title('DINWOODIE Wind Farm Maintenance Requests Timeline (All Requests)', 
                 fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('Time', fontsize=12)
    
    # Add legend
    legend_elements = [plt.Rectangle((0,0),1,1, facecolor=colors['maintenance'], 
                                    alpha=0.8, label='Maintenance Request'),
                      plt.Rectangle((0,0),1,1, facecolor=colors['repair'], 
                                  alpha=0.8, label='Repair Request')]
    ax.legend(handles=legend_elements, loc='upper right')
    
    # Add grid
    ax.grid(True, alpha=0.3, axis='x')
    
    # Adjust layout
    plt.tight_layout()
    
    # Save the plot
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Gantt chart saved as: {output_file}")
    
    # Show the plot
    plt.show()


def create_detailed_gantt_chart(maintenance_data, sim, output_file="dinwoodie_detailed_gantt.png"):
    """
    Create a more detailed Gantt chart showing request and completion times.
    
    Parameters
    ----------
    maintenance_data : pd.DataFrame
        DataFrame containing maintenance request information
    sim : Simulation
        The simulation object to get completion events from
    output_file : str
        Output filename for the detailed Gantt chart
    """
    if maintenance_data.empty:
        print("No maintenance requests found in simulation data.")
        return
    
    # Get completion events
    events = sim.metrics.events
    completion_events = events[
        events['action'].isin(['maintenance complete', 'repair complete'])
    ].copy()
    
    # Merge request and completion data
    request_data = maintenance_data[['request_id', 'datetime', 'task_description', 
                                   'request_type', 'part_name']].copy()
    request_data = request_data.rename(columns={'datetime': 'request_time'})
    
    completion_data = completion_events[['request_id', 'env_datetime']].copy()
    completion_data['completion_time'] = pd.to_datetime(completion_data['env_datetime'])
    
    # Merge the data
    detailed_data = request_data.merge(completion_data, on='request_id', how='left')
    
    # Filter out requests without completion data (ongoing or canceled)
    completed_data = detailed_data.dropna(subset=['completion_time'])
    
    if completed_data.empty:
        print("No completed maintenance tasks found.")
        return
    
    # Create the figure
    fig, ax = plt.subplots(figsize=(16, max(10, len(completed_data) * 0.5)))
    
    # Color mapping
    colors = {'maintenance': '#2E86AB', 'repair': '#A23B72'}
    
    # Create horizontal bars for each completed task
    y_positions = range(len(completed_data))
    
    for i, (idx, row) in enumerate(completed_data.iterrows()):
        color = colors.get(row['request_type'], '#6C757D')
        
        # Create bar from request to completion
        duration = row['completion_time'] - row['request_time']
        ax.barh(i, duration, left=row['request_time'], 
                height=0.6, color=color, alpha=0.7)
        
        # Add text label
        ax.text(row['request_time'] + duration/2, i, 
                f"{row['task_description']}\n({duration.days} days)", 
                va='center', ha='center', fontsize=8)
    
    # Customize the plot
    ax.set_yticks(y_positions)
    ax.set_yticklabels([])
    
    # Format x-axis
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=6))
    ax.xaxis.set_minor_locator(mdates.MonthLocator(interval=1))
    
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    # Add title and labels
    ax.set_title('DINWOODIE Wind Farm Maintenance Task Durations', 
                 fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('Time', fontsize=12)
    
    # Add legend
    legend_elements = [plt.Rectangle((0,0),1,1, facecolor=colors['maintenance'], 
                                    alpha=0.7, label='Maintenance Task'),
                      plt.Rectangle((0,0),1,1, facecolor=colors['repair'], 
                                  alpha=0.7, label='Repair Task')]
    ax.legend(handles=legend_elements, loc='upper right')
    
    # Add grid
    ax.grid(True, alpha=0.3, axis='x')
    
    # Adjust layout
    plt.tight_layout()
    
    # Save the plot
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Detailed Gantt chart saved as: {output_file}")
    
    plt.show()


def print_summary_statistics(maintenance_data):
    """
    Print summary statistics about the maintenance requests.
    
    Parameters
    ----------
    maintenance_data : pd.DataFrame
        DataFrame containing maintenance request information
    """
    if maintenance_data.empty:
        print("No maintenance requests found.")
        return
    
    print("\n" + "="*60)
    print("MAINTENANCE REQUEST SUMMARY")
    print("="*60)
    
    # Total requests
    total_requests = len(maintenance_data)
    print(f"Total maintenance requests: {total_requests}")
    
    # Requests by type
    request_types = maintenance_data['request_type'].value_counts()
    print("\nRequests by type:")
    for req_type, count in request_types.items():
        print(f"  {req_type.capitalize()}: {count}")
    
    # Requests by component
    component_requests = maintenance_data['part_name'].value_counts()
    print("\nRequests by component:")
    for component, count in component_requests.head(10).items():
        print(f"  {component}: {count}")
    
    # Time range
    start_time = maintenance_data['datetime'].min()
    end_time = maintenance_data['datetime'].max()
    print(f"\nSimulation time range: {start_time.strftime('%Y-%m-%d')} to {end_time.strftime('%Y-%m-%d')}")
    
    # Monthly distribution
    monthly_requests = maintenance_data.groupby(maintenance_data['datetime'].dt.to_period('M')).size()
    print(f"\nAverage requests per month: {monthly_requests.mean():.1f}")
    print(f"Peak month: {monthly_requests.idxmax()} with {monthly_requests.max()} requests")


def main():
    """
    Main function to run the DINWOODIE simulation and create Gantt charts.
    """
    print("DINWOODIE Maintenance Gantt Chart Generator")
    print("="*50)
    
    # Run the simulation
    try:
        sim = run_dinwoodie_simulation("base_2yr")
    except Exception as e:
        print(f"Error running simulation: {e}")
        return
    
    # Extract maintenance data
    maintenance_data = extract_maintenance_requests(sim)
    
    # Print summary statistics
    print_summary_statistics(maintenance_data)
    
    # Create Gantt charts
    if not maintenance_data.empty:
        create_gantt_chart(maintenance_data)
        create_detailed_gantt_chart(maintenance_data, sim)
    else:
        print("No maintenance requests found in the simulation data.")


if __name__ == "__main__":
    main() 