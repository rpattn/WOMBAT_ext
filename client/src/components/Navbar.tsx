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
                to="/results/gantt"
                className={({ isActive }: { isActive: boolean }) => (isActive ? 'link active' : 'link') + ' dropdown-item'}
              >
                Gantt
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
