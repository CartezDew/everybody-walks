import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function FilterSelect({ label, allLabel, value, options, optionLabels = {}, onChange }) {
  const id = useId();
  const trigger = useRef(null);
  const menu = useRef(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [position, setPosition] = useState({});
  const choices = ['All', ...options];
  const caption = key => key === 'All' ? allLabel : optionLabels[key] ?? key;

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = trigger.current.getBoundingClientRect();
      if (!rect.width || rect.bottom <= 0 || rect.top >= innerHeight) {
        setOpen(false);
        return;
      }
      const width = Math.min(innerWidth - 16, Math.max(rect.width, options.length > 8 ? 270 : 190));
      const below = innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const flip = below < Math.min(280, choices.length * 42 + 12) && above > below;
      setPosition({
        width,
        left: Math.max(8, Math.min(rect.left, innerWidth - width - 8)),
        top: flip ? undefined : rect.bottom + 4,
        bottom: flip ? innerHeight - rect.top + 4 : undefined,
        maxHeight: Math.min(310, Math.max(64, flip ? above : below)),
      });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, options.length, choices.length]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event) {
      if (!trigger.current.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  useLayoutEffect(() => {
    const option = menu.current?.children[cursor];
    if (!open || !option) return;
    const panel = menu.current;
    if (option.offsetTop < panel.scrollTop) panel.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > panel.scrollTop + panel.clientHeight)
      panel.scrollTop = option.offsetTop + option.offsetHeight - panel.clientHeight;
  }, [cursor, open, position.maxHeight]);

  function show() {
    search.current.text = '';
    setCursor(Math.max(0, choices.indexOf(value)));
    setOpen(true);
  }
  function select(key) {
    onChange(key);
    setOpen(false);
    trigger.current.focus({ preventScroll: true });
  }
  function keyboard(event) {
    const key = event.key;
    if (key === 'Escape' || key === 'Tab') {
      if (open && key === 'Escape') event.preventDefault();
      setOpen(false);
      return;
    }
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      if (!open) { show(); return; }
      if (key === 'Enter' || key === ' ') select(choices[cursor]);
      else if (key === 'Home') setCursor(0);
      else if (key === 'End') setCursor(choices.length - 1);
      else setCursor(Math.max(0, Math.min(choices.length - 1, cursor + (key === 'ArrowDown' ? 1 : -1))));
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (!open) show();
      const now = Date.now();
      const prefix = (now - search.current.time < 650 ? search.current.text : '') + key.toLowerCase();
      search.current = { text: prefix, time: now };
      const match = choices.findIndex(item => caption(item).toLowerCase().startsWith(prefix));
      if (match !== -1) setCursor(match);
    }
  }
  return <div className={'fl' + (value === 'All' ? '' : ' active')}>
    <label htmlFor={id}>{label}</label>
    <button id={id} ref={trigger} className="filter-trigger" type="button" role="combobox"
      aria-label={label} aria-describedby={id+'-value'} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id+'-list' : undefined}
      aria-activedescendant={open ? id+'-'+cursor : undefined} onBlur={() => setOpen(false)}
      onKeyDown={keyboard} onClick={() => open ? setOpen(false) : show()}>
      <span id={id+'-value'}>{caption(value)}</span><i aria-hidden="true"/>
    </button>
    {open && createPortal(<div ref={menu} id={id+'-list'} role="listbox" aria-label={label} className="filter-options" style={position}>
      {choices.map((key,i) => <div role="option" id={id+'-'+i} key={key} aria-selected={key === value}
        className={i === cursor ? 'option-cursor' : ''} onMouseDown={event => event.preventDefault()}
        onClick={() => select(key)}><span>{caption(key)}</span>{key === value && <b aria-hidden="true">✓</b>}</div>)}
    </div>, document.body)}
  </div>;
}
