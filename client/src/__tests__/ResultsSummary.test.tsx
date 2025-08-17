import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ResultsSummary from '../components/ResultsSummary'

describe('ResultsSummary', () => {
  it('renders empty state when no data', () => {
    render(<ResultsSummary />)
    expect(screen.getByText(/No results yet/i)).toBeInTheDocument()
  })

  it('renders populated stats and breakdowns', () => {
    const data = {
      status: 'finished',
      results: { events: 1, operations: 2, power_potential: 3, power_production: 4, metrics_input: 5 },
      stats: {
        maintenance: {
          total_requests: 10,
          start_time: 't0',
          end_time: 't1',
          average_requests_per_month: 2.5,
          peak_month: 'Jan',
          peak_month_count: 4,
          requests_by_type: { a: 1, b: 2 },
          requests_by_component: { x: 3, y: 4 },
        },
        power_production: {
          start_time: 'p0', end_time: 'p1', hours: 100,
          windfarm_energy_mwh: 123.456, avg_windfarm_power_mw: 1.23, peak_windfarm_power_mw: 9.87,
          capacity_factor: 0.42,
          monthly_energy_mwh: { m1: 10, m2: 20 },
          per_component_energy_mwh: { t1: 5, t2: 6 },
        },
      },
    }
    render(<ResultsSummary data={data} />)
    expect(screen.getByText('finished')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('123.46')).toBeInTheDocument()
    expect(screen.getByText('42.0%')).toBeInTheDocument()
    expect(screen.getByText(/By type/i)).toBeInTheDocument()
    expect(screen.getByText(/Top components/i)).toBeInTheDocument()
  })
})
