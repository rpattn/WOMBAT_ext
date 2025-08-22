import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import hero from '../assets/hero.svg';

export default function Splash() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('in-view'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) el.classList.add('in-view');
        else el.classList.remove('in-view');
      });
    }, { threshold: 0.15 });
    els.forEach(el => io.observe(el));
    return () => {
      els.forEach(el => io.unobserve(el));
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    // Fade-in on load
    const content = document.querySelector('.splash-hero-content');
    if (content) content.classList.add('fade-in');

    // Parallax for hero background via CSS vars
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const hero = document.querySelector<HTMLElement>('.splash-hero');
    if (!hero) return;
    const onScroll = () => {
      const r = hero.getBoundingClientRect();
      // factor scales how much movement: smaller = subtler
      const factor = 0.06;
      const x = Math.max(-30, Math.min(30, -r.left * factor));
      const y = Math.max(-30, Math.min(30, -r.top * factor));
      hero.style.setProperty('--parallax-x', `${x}px`);
      hero.style.setProperty('--parallax-y', `${y}px`);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return (
    <main className="app-container splash-page" style={{ width: '100%', padding: 0, maxWidth: '100%' }}>
      <section className="splash-hero">
        <div className="splash-hero-content splash-inner">
          <h1 className="splash-title">WOMBAT_ext</h1>
          <p className="splash-subtitle">
            Plan, run, and analyze offshore wind operations. <br />
            Powerful simulation manager. <br />
            Rich results exploration.
          </p>
          <div className="splash-cta">
            <Link to="/sim" className="btn btn-primary">Open Simulation Manager</Link>
            <Link to="/results" className="btn btn-secondary">Browse Results</Link>
          </div>
          <div className="splash-illustration" style={{width: '110%', height: '110%'}}>
            <img src={hero} alt="Offshore wind hero" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="splash-inner">
          <h2 className="section-title reveal in-view">Capabilities</h2>
          <div className="splash-grid">
          <article className="panel reveal">
            <h3 className="panel-title">Simulation Manager</h3>
            <div className="panel-body">
              <p>Configure and run simulations with a streamlined editor, saved library management, and a global sidebar toggle.</p>
              <ul className="list-unstyled">
                <li className="item-row">Inline editors with lazy-loading for heavy components</li>
                <li className="item-row">Saved libraries: load, restore working, delete</li>
                <li className="item-row">Global theme selector and sidebar toggle</li>
              </ul>
              <p><Link to="/sim" className="link">Go to Simulation Manager →</Link></p>
            </div>
          </article>

          <article className="panel reveal">
            <h3 className="panel-title">Results Exploration</h3>
            <div className="panel-body">
              <p>View summaries, compare multiple runs, and explore CSV/PNG/HTML outputs inline.</p>
              <ul className="list-unstyled">
                <li className="item-row">Results Compare: multi-library YAML summaries with labels</li>
                <li className="item-row">Operations: CSV preview with per-column filters and instant charts</li>
                <li className="item-row">Gantt variants with theme-aware Plotly styling</li>
              </ul>
              <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/results" className="link">Results →</Link>
                <Link to="/results/compare" className="link">Compare →</Link>
                <Link to="/results/operations" className="link">Operations →</Link>
                <Link to="/results/gantt" className="link">Gantt →</Link>
              </p>
            </div>
          </article>

          <article className="panel reveal">
            <h3 className="panel-title">Layout Map</h3>
            <div className="panel-body">
              <p>Interactive Leaflet map rendering from <code>project/plant/layout.csv</code> with auto-fit bounds and grouped strings.</p>
              <ul className="list-unstyled">
                <li className="item-row">Hover labels, farm boundary hull, and optional polylines</li>
                <li className="item-row">Plugged into Saved Libraries and File Selector</li>
              </ul>
              <p><Link to="/simulation/layout" className="link">Open Layout Map →</Link></p>
            </div>
          </article>

          <article className="panel reveal">
            <h3 className="panel-title">Connections & Mocking</h3>
            <div className="panel-body">
              <p>Connect to a server or use the mock worker: API calls transparently fall back when running locally.</p>
              <ul className="list-unstyled">
                <li className="item-row">Centralized mock fallbacks in API layer</li>
                <li className="item-row">Saved libraries read-only endpoints supported</li>
              </ul>
              <p><Link to="/connect" className="link">Connection Manager →</Link></p>
            </div>
          </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="splash-inner">
          <h2 className="section-title reveal">Learn more</h2>
          <ul className="list-unstyled reveal">
            <li className="item-row"><a href="https://github.com/rpattn/WOMBAT_ext#readme" target="_blank" rel="noreferrer" className="link">Documentation (README)</a></li>
            <li className="item-row"><a href="https://github.com/rpattn/WOMBAT_ext" target="_blank" rel="noreferrer" className="link">GitHub repository</a></li>
            <li className="item-row"><a href="https://github.com/rpattn/WOMBAT_ext/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer" className="link">Changelog</a></li>
          </ul>
        </div>
      </section>
      <div className='section' style={{ height: 'var(--navbar-height)' }}></div>

    </main>
  );
}
