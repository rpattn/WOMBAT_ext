import type { FileEntry, Task } from './types';

export const activeClients = new Set<string>();
export const clientStores = new Map<string, Map<string, FileEntry>>();
export const savedLibraries = new Set<string>(['dinwoodie_mock', 'dinwoodie_base']);
export const tasks = new Map<string, Task>();
export const progressTimers = new Map<string, any>();

function tinyPngB64(): string {
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAuMBgVnQp5kAAAAASUVORK5CYII=';
}

export function templateLibrary(name = 'Dinwoodie Mock'): Map<string, FileEntry> {
  const fs = new Map<string, FileEntry>();
  fs.set('project\\config\\base.yaml', {
    kind: 'yaml',
    data: {
      name: (name || 'dinwoodie_base').toLowerCase().replace(/\s+/g, '_'),
      library: 'DINWOODIE',
      weather: 'alpha_ventus_weather_2002_2014.csv',
      service_equipment: ['ctv1.yaml', 'ctv2.yaml', 'ctv3.yaml', 'fsv_requests.yaml', 'hlv_requests.yaml'],
      layout: 'layout.csv',
      inflation_rate: 0,
      fixed_costs: 'fixed_costs.yaml',
      workday_start: 7,
      workday_end: 19,
      start_year: 2003,
      end_year: 2012,
      project_capacity: 240,
      parameters: { turbines: 5, cable_voltage_kv: 66 },
    },
  });
  fs.set('results\\events.csv', {
    kind: 'text',
    mime: 'text/csv',
    data: [
      ['env_datetime','duration','action','agent','part_name','system_id','request_id'].join(','),
      ['2003-01-04T07:15:03.000Z','11.499166666666667','repair','CTV 3','turbine','S00T66','RPR00000000'].join(','),
      ['2003-01-05T08:15:00.000Z','9.75','repair','CTV 3','turbine','S00T66','RPR00000000'].join(','),
      ['2003-01-07T07:15:00.000Z','0.7508333333333326','repair','CTV 3','turbine','S00T66','RPR00000000'].join(','),
      ['2003-01-10T07:15:08.000Z','3','repair','CTV 2','turbine','S00T60','RPR00000001'].join(','),
      ['2003-02-13T07:15:02.000Z','11.499444444444444','repair','CTV 2','turbine','S00T13','RPR00000002'].join(','),
      ['2003-02-14T08:15:00.000Z','10.5','repair','CTV 2','turbine','S00T13','RPR00000002'].join(','),
      ['2003-02-15T08:15:00.000Z','0.0005555555555574188','repair','CTV 2','turbine','S00T13','RPR00000002'].join(','),
      ['2003-03-17T07:15:06.000Z','3','repair','CTV 3','turbine','S00T17','RPR00000003'].join(','),
      ['2003-03-29T07:15:04.000Z','7.5','repair','CTV 3','turbine','S00T14','RPR00000004'].join(','),
      ['2003-04-01T06:15:00.000Z','7.5','repair','CTV 3','turbine','S00T75','RPR00000005'].join(','),
      ['2003-04-11T06:15:01.000Z','3','repair','CTV 3','turbine','S00T66','RPR00000006'].join(','),
    ].join('\n') + '\n',
  });
  fs.set('project\\plant\\layout.csv', {
    kind: 'text',
    mime: 'text/csv',
    data:
      'id,substation_id,name,type,longitude,latitude,string,order,distance,subassembly,upstream_cable\n' +
      'OSS1,OSS1,OSS1,substation,-121.7000,35.40000,,, , ,offshore_substation.yaml,export.yaml\n' +
      'T02,OSS1,T02,turbine,-121.668,35.43564,0,0,0,vestas_v90.yaml,array.yaml\n' +
      'T03,OSS1,T03,turbine,-121.692,35.43590,0,1,0,vestas_v90.yaml,array.yaml\n' +
      'T04,OSS1,T04,turbine,-121.715,35.43615,0,2,0,vestas_v90.yaml,array.yaml\n' +
      'T05,OSS1,T05,turbine,-121.739,35.43640,0,3,0,vestas_v90.yaml,array.yaml\n' +
      'T06,OSS1,T06,turbine,-121.763,35.43665,0,4,0,vestas_v90.yaml,array.yaml\n' +
      'T07,OSS1,T07,turbine,-121.787,35.43689,0,5,0,vestas_v90.yaml,array.yaml\n' +
      'T08,OSS1,T08,turbine,-121.811,35.43713,0,6,0,vestas_v90.yaml,array.yaml\n' +
      'T09,OSS1,T09,turbine,-121.834,35.43736,0,7,0,vestas_v90.yaml,array.yaml\n' +
      'T10,OSS1,T10,turbine,-121.858,35.43759,0,8,0,vestas_v90.yaml,array.yaml\n' +
      'T11,OSS1,T11,turbine,-121.882,35.43781,0,9,0,vestas_v90.yaml,array.yaml\n' +
      'T12,OSS1,T12,turbine,-121.668,35.41616,1,0,0,vestas_v90.yaml,array.yaml\n' +
      'T13,OSS1,T13,turbine,-121.692,35.41642,1,1,0,vestas_v90.yaml,array.yaml\n' +
      'T14,OSS1,T14,turbine,-121.716,35.41668,1,2,0,vestas_v90.yaml,array.yaml\n' +
      'T15,OSS1,T15,turbine,-121.739,35.41693,1,3,0,vestas_v90.yaml,array.yaml\n' +
      'T16,OSS1,T16,turbine,-121.763,35.41718,1,4,0,vestas_v90.yaml,array.yaml\n' +
      'T17,OSS1,T17,turbine,-121.787,35.41742,1,5,0,vestas_v90.yaml,array.yaml\n' +
      'T18,OSS1,T18,turbine,-121.811,35.41765,1,6,0,vestas_v90.yaml,array.yaml\n' +
      'T19,OSS1,T19,turbine,-121.835,35.41789,1,7,0,vestas_v90.yaml,array.yaml\n' +
      'T20,OSS1,T20,turbine,-121.858,35.41811,1,8,0,vestas_v90.yaml,array.yaml\n' +
      'T21,OSS1,T21,turbine,-121.882,35.41834,1,9,0,vestas_v90.yaml,array.yaml\n',
  });
  fs.set('weather\\alpha_ventus_weather_2002_2014.csv', {
    kind: 'text',
    mime: 'text/csv',
    data:
      'datetime,wind_ms,wave_hs_m,wave_tp_s,air_temp_c\n' +
      '2002-01-01T00:00:00Z,9.5,1.2,7.5,5.0\n' +
      '2002-01-01T01:00:00Z,10.1,1.3,7.7,4.9\n' +
      '2002-01-01T02:00:00Z,8.8,1.1,7.2,4.7\n',
  });
  fs.set('cables\\array.yaml', {
    kind: 'yaml',
    data: {
      name: 'array cable',
      maintenance: [{ description: 'n/a', time: 0, materials: 0, service_equipment: 'CTV', frequency: 0 }],
      failures: [{ scale: 0, shape: 0, time: 0, materials: 0, operation_reduction: 0, service_equipment: 'CAB', level: 1, description: 'n/a' }],
    },
  });
  fs.set('cables\\export.yaml', {
    kind: 'yaml',
    data: {
      name: 'export cable',
      maintenance: [{ description: 'n/a', time: 0, materials: 0, service_equipment: 'CTV', frequency: 0 }],
      failures: [{ scale: 0, shape: 0, time: 0, materials: 0, operation_reduction: 0, service_equipment: 'CAB', level: 1, description: 'none' }],
    },
  });
  fs.set('turbines\\vestas_v90.yaml', {
    kind: 'yaml',
    data: {
      capacity_kw: 3000,
      capex_kw: 1300,
      power_curve: { file: 'vestas_v90_power_curve.csv', bin_width: 0.5 },
      turbine: {
        name: 'turbine',
        maintenance: [{ description: 'annual service', time: 60, materials: 18500, service_equipment: 'CTV', frequency: 365 }],
        failures: [
          { scale: 10.1333, shape: 1, time: 3, materials: 0, service_equipment: 'CTV', operation_reduction: 0.0, level: 1, description: 'manual reset' },
          { scale: 10.3333, shape: 1, time: 7.5, materials: 1000, service_equipment: 'CTV', operation_reduction: 0.0, level: 2, description: 'minor repair' },
          { scale: 13.6363, shape: 1, time: 22, materials: 18500, service_equipment: 'CTV', operation_reduction: 0.0, level: 3, description: 'medium repair' },
          { scale: 125, shape: 1, time: 26, materials: 73500, service_equipment: 'SCN', operation_reduction: 0.0, level: 4, description: 'major repair' },
          { scale: 112.5, shape: 1, time: 52, materials: 334500, service_equipment: 'LCN', operation_reduction: 0.0, replacement: true, level: 5, description: 'major replacement' },
        ],
      },
    },
  });
  fs.set('turbines\\vestas_v90_power_curve.csv', {
    kind: 'text',
    mime: 'text/csv',
    data: 'wind_ms,power_kw\n4,50\n6,250\n8,600\n10,1350\n12,1800\n14,2000\n',
  });
  fs.set('vessels\\ctv1.yaml', {
    kind: 'yaml',
    data: {
      name: 'CTV 1',
      equipment_rate: 1750,
      start_month: 1,
      start_day: 1,
      end_month: 12,
      end_day: 31,
      start_year: 2002,
      end_year: 2014,
      onsite: true,
      capability: 'CTV',
      max_severity: 10,
      mobilization_cost: 0,
      mobilization_days: 0,
      speed: 37.04,
      max_windspeed_transport: 99,
      max_windspeed_repair: 99,
      max_waveheight_transport: 1.5,
      max_waveheight_repair: 1.5,
      strategy: 'scheduled',
      crew_transfer_time: 0.25,
      n_crews: 1,
      crew: { day_rate: 0, n_day_rate: 0, hourly_rate: 0, n_hourly_rate: 0 },
    },
  });
  fs.set('vessels\\ctv2.yaml', { kind: 'yaml', data: { name: 'CTV 2', capability: 'CTV', onsite: true } });
  fs.set('vessels\\ctv3.yaml', { kind: 'yaml', data: { name: 'CTV 3', capability: 'CTV', onsite: true } });
  fs.set('vessels\\fsv_requests.yaml', { kind: 'yaml', data: { name: 'fsv_requests', requests: [] } });
  fs.set('vessels\\hlv_requests.yaml', { kind: 'yaml', data: { name: 'hlv_requests', requests: [] } });
  fs.set('project\\config\\fixed_costs.yaml', {
    kind: 'yaml',
    data: { fixed_costs: { project_management_usd_per_year: 0, site_lease_usd_per_year: 0, insurance_usd_per_year: 0, monitoring_usd_per_year: 0 } },
  });
  fs.set('results\\summary.yaml', {
    kind: 'yaml',
    data: {
      summary: 'Mock simulation complete',
      status: 'finished',
      finished_at: new Date().toISOString(),
      task: 'mock',
      energy_mwh: 12500,
      capacity_mw: 15,
      stats: {
        maintenance: {
          total_requests: 8,
          start_time: '2003-01-01T00:00:00Z',
          end_time: '2003-12-31T23:59:59Z',
          average_requests_per_month: 0.7,
          peak_month: '2003-03',
          peak_month_count: 2,
          requests_by_type: { repair: 5, service: 3 },
          requests_by_component: { T01: 2, T02: 2, T03: 1, T04: 2, T05: 1 },
        },
        power_production: {
          start_time: '2003-01-01T00:00:00Z',
          end_time: '2003-12-31T23:59:59Z',
          hours: 8760,
          windfarm_energy_mwh: 12500,
          avg_windfarm_power_mw: Number((12500 / 8760).toFixed(2)),
          peak_windfarm_power_mw: 12.75,
          capacity_factor: Number(((12500 / 8760) / 15).toFixed(3)),
          monthly_energy_mwh: {
            '2003-01': 1150,
            '2003-02': 980,
            '2003-03': 1120,
            '2003-04': 1060,
            '2003-05': 1000,
            '2003-06': 980,
            '2003-07': 1010,
            '2003-08': 1040,
            '2003-09': 1060,
            '2003-10': 1060,
            '2003-11': 1020,
            '2003-12': 1030,
          },
          per_component_energy_mwh: { T01: 2100, T02: 2120, T03: 2150, T04: 2180, T05: 2200 },
        },
      },
    },
  });
  fs.set('results\\report.html', { kind: 'text', mime: 'text/html', data: '<!doctype html><html><head><meta charset="utf-8"><title>Mock Report</title></head><body><h1>Mock Report</h1><p>This is a mock HTML report.</p></body></html>' });
  fs.set('results\\plot.png', { kind: 'binary', mime: 'image/png', data: tinyPngB64() });
  // Default operations.csv for Operations page (pipe-delimited)
  {
    const header = ['env_datetime', 'env_time', 'T01', 'T02', 'T03', 'T04', 'T05'].join('|');
    const start = new Date('2003-01-01T00:00:00Z');
    const mk = (h: number, a1: number, a2: number, a3: number, a4: number, a5: number) => [
      new Date(start.getTime() + h * 3_600_000).toISOString(),
      String(h),
      a1.toFixed(3),
      a2.toFixed(3),
      a3.toFixed(3),
      a4.toFixed(3),
      a5.toFixed(3),
    ].join('|');
    const rows = [
      header,
      mk(0, 0.95, 0.93, 0.92, 0.91, 0.94),
      mk(1, 0.96, 0.92, 0.91, 0.90, 0.95),
      mk(2, 0.97, 0.94, 0.93, 0.88, 0.96),
      mk(3, 0.98, 0.95, 0.90, 0.87, 0.97),
      mk(4, 0.99, 0.96, 0.89, 0.86, 0.98),
      mk(5, 0.95, 0.90, 0.85, 0.80, 0.94),
      mk(6, 0.92, 0.88, 0.83, 0.78, 0.91),
      mk(7, 0.94, 0.90, 0.85, 0.80, 0.93),
      mk(8, 0.96, 0.92, 0.87, 0.82, 0.95),
      mk(9, 0.97, 0.93, 0.88, 0.83, 0.96),
    ];
    fs.set('results\\operations.csv', { kind: 'text', mime: 'text/csv', data: rows.join('\n') + '\n' });
  }
  return fs;
}

export function ensureClientStore(clientId: string): Map<string, FileEntry> {
  let store = clientStores.get(clientId);
  if (!store) {
    store = templateLibrary();
    clientStores.set(clientId, store);
  }
  return store;
}
