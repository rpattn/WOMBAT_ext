import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <nav className={`navbar ${open ? 'open' : ''}`}>
      <div className="navbar-inner app-full">
        <div className="brand">WOMBAT_ext</div>
        <button
          className="menu-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          onClick={() => setOpen(prev => !prev)}
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </button>
        <div className="links" onClick={() => setOpen(false)}>
          <div className="dropdown">
            <NavLink
              to="/"
              end
              className={({ isActive }: { isActive: boolean }) => isActive ? 'link active' : 'link'}
            >
              Home
            </NavLink>
          </div>
          <div className="dropdown">
            <NavLink
              to="/connect"
              className={({ isActive }: { isActive: boolean }) => isActive ? 'link active' : 'link'}
            >
              Connection Manager
            </NavLink>
          </div>
          <div className="dropdown">
            <NavLink
              to="/sim"
              className={({ isActive }: { isActive: boolean }) => isActive ? 'link active' : 'link'}
            >
              Simulation Manager
            </NavLink>
            <div className="dropdown-menu" role="menu">
              <NavLink
                to="/sim"
                className={({ isActive }: { isActive: boolean }) => (isActive ? 'link active' : 'link') + ' dropdown-item'}
              >
                Overview
              </NavLink>
              <NavLink
                to="/run"
                className={({ isActive }: { isActive: boolean }) => (isActive ? 'link active' : 'link') + ' dropdown-item'}
              >
                Run
              </NavLink>
              <NavLink
                to="/simulation/layout"
                className={({ isActive }: { isActive: boolean }) => (isActive ? 'link active' : 'link') + ' dropdown-item'}
              >
                Layout Map
              </NavLink>
            </div>
          </div>
          <div className="dropdown">
            <NavLink
              to="/results"
              className={({ isActive }: { isActive: boolean }) => isActive ? 'link active' : 'link'}
            >
              Results
            </NavLink>
            <div className="dropdown-menu" role="menu">
              <NavLink
                to="/results/compare"
                className={({ isActive }: { isActive: boolean }) => (isActive ? 'link active' : 'link') + ' dropdown-item'}
              >
                Compare
              </NavLink>
              <NavLink
                to="/results/operations"
                className={({ isActive }: { isActive: boolean }) => (isActive ? 'link active' : 'link') + ' dropdown-item'}
              >
                Operations
              </NavLink>
              <NavLink
                to="/results/gantt"
                className={({ isActive }: { isActive: boolean }) => (isActive ? 'link active' : 'link') + ' dropdown-item'}
              >
                Gantt
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </nav >
  );
}
