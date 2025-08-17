import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <nav className={`navbar ${open ? 'open' : ''}`}>
      <div className="navbar-inner">
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
          <NavLink
            to="/connect"
            className={({ isActive }: { isActive: boolean }) => isActive ? 'link active' : 'link'}
          >
            Connection Manager
          </NavLink>
          <NavLink
            to="/"
            end
            className={({ isActive }: { isActive: boolean }) => isActive ? 'link active' : 'link'}
          >
            Simulation Manager
          </NavLink>
          <NavLink
            to="/results"
            className={({ isActive }: { isActive: boolean }) => isActive ? 'link active' : 'link'}
          >
            Results
          </NavLink>
          <NavLink
            to="/results/compare"
            className={({ isActive }: { isActive: boolean }) => isActive ? 'link active' : 'link'}
          >
            Compare
          </NavLink>
          <NavLink
            to="/results/gantt"
            className={({ isActive }: { isActive: boolean }) => isActive ? 'link active' : 'link'}
          >
            Gantt
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
