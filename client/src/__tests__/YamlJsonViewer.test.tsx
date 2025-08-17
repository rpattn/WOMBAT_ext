import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import YamlJsonViewer from '../components/YamlJsonViewer'

describe('YamlJsonViewer', () => {
  it('renders No content for null or empty object', () => {
    const { rerender } = render(<YamlJsonViewer data={null} title="T" />)
    expect(screen.getByText('No content.')).toBeInTheDocument()

    rerender(<YamlJsonViewer data={{}} title="T" />)
    expect(screen.getByText('No content.')).toBeInTheDocument()
  })

  it('renders string payload in pre block', () => {
    render(<YamlJsonViewer data={'hello'} title="T" />)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('renders object tree', () => {
    render(<YamlJsonViewer data={{ a: 1, b: 'x' }} title="Obj" />)
    expect(screen.getByText('Obj')).toBeInTheDocument()
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
    expect(screen.getByText('x')).toBeInTheDocument()
  })

  it('renders array tree', () => {
    render(<YamlJsonViewer data={{ arr: [1, 2, 3] }} title="Arr" />)
    expect(screen.getByText('Arr')).toBeInTheDocument()
    expect(screen.getByText('[0]')).toBeInTheDocument()
    expect(screen.getByText('[1]')).toBeInTheDocument()
    expect(screen.getByText('[2]')).toBeInTheDocument()
  })
})
