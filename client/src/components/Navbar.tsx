import { NavLink } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="brand">WOMBAT</div>
        <div className="links">
          <NavLink
            to="/connect"
            className={({ isActive }: { isActive: boolean }) => isActive ? 'link active' : 'link'}
          >
            WebSocket Client
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
        </div>
      </div>
    </nav>
  );
}
