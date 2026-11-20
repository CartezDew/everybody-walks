import { useLayoutEffect, useRef, useState } from 'react';

const icons = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  demographics: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21v-2a8 8 0 0 1 16 0v2 M3 10a3 3 0 0 1 3-3 M21 10a3 3 0 0 0-3-3',
  money: 'M3 6h17v13H3z M3 7V5l14-3v4 M15 10h6v5h-6z',
  academic: 'M2 5q5-2 10 1 5-3 10-1v14q-5-2-10 1-5-3-10-1z M12 6v14',
  alert: 'M3 6h7m4 0h7M3 12h12m4 0h2M3 18h2m4 0h12 M10 3v6m5 0v6m-9 0v6',
  who: 'M3 20v-3q0-4 6-4t6 4v3 M12 7a3 3 0 1 1-6 0 3 3 0 1 1 6 0 M16 5q5 1 2 6m-1 3q4 0 4 5',
  more: 'M3 20h18 M5 16v-4m5 4V8m5 8v-6m5 6V4',
  insights: 'm10 3 2.1 5.9L18 11l-5.9 2.1L10 19l-2.1-5.9L2 11l5.9-2.1z M19 2v5m-2.5-2.5h5 M19 16v5m-2.5-2.5h5',
  act: 'm3 6 2 2 4-5 M12 6h9 M3 13l2 2 4-5 M12 13h9 M12 20h9',
  methods: 'M5 2h9l5 5v15H5z M14 2v6h5 M8 12h8m-8 4h8',
};

export default function ExplorerNav({ items, go, hasData }) {
  const [expanded, setExpanded] = useState(() => window.innerWidth > 1000);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [current, setCurrent] = useState('overview');
  const toggle = useRef(null);
  const enabled = id => hasData || ['overview','demographics','insights','act','methods'].includes(id);

  useLayoutEffect(() => {
    const filter = document.querySelector('.filterbar');
    const header = document.querySelector('.topbar');
    const root = document.documentElement;
    let frame;
    function measure() {
      const top = header.offsetHeight + filter.offsetHeight;
      root.style.setProperty('--explorer-top', top+'px');
      const sections = items.map(([id]) => document.getElementById(id)).filter(Boolean);
      const line = top + (window.innerWidth <= 820 ? 68 : 24);
      setCurrent((sections.filter(el => el.getBoundingClientRect().top <= line).pop() || sections[0])?.id || 'overview');
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(filter);
    observer.observe(header);
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
      cancelAnimationFrame(frame);
      root.style.removeProperty('--explorer-top');
    };
  }, [items, hasData]);

  function navigate(id) {
    setMobileOpen(false);
    go(id);
    if (window.innerWidth <= 820) toggle.current?.focus({preventScroll:true});
  }
  const currentLabel = items.find(([id]) => id === current)?.[1];
  return <nav className={'section-rail'+(expanded?' expanded':'')+(mobileOpen?' mobile-open':'')} aria-label="Evidence sections"
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMobileOpen(false); }}
    onKeyDown={event => { if(event.key === 'Escape' && mobileOpen) {setMobileOpen(false);toggle.current.focus();} }}>
    <button className="rail-toggle desktop-toggle" aria-expanded={expanded} aria-controls="evidence-links"
      title={expanded?'Collapse navigation':'Expand navigation'} aria-label={expanded?'Collapse navigation':'Expand navigation'} onClick={()=>setExpanded(!expanded)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg><span>Explorer</span>
    </button>
    <button ref={toggle} className="rail-toggle mobile-toggle" aria-expanded={mobileOpen} aria-controls="evidence-links" onClick={()=>setMobileOpen(!mobileOpen)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18M3 12h18M3 19h18"/></svg>Sections <b>{currentLabel}</b><i aria-hidden="true">⌄</i>
    </button>
    <div id="evidence-links" className="rail-links">{items.map(([id,label])=><button key={id} aria-label={label} title={label} disabled={!enabled(id)}
      aria-current={current===id?'location':undefined} onClick={()=>navigate(id)}>
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d={icons[id]}/></svg><span>{label}</span>
    </button>)}</div>
  </nav>;
}
