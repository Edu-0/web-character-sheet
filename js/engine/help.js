let nextHelpId = 0;
let activeHelp = null;

window.addEventListener('resize', () => activeHelp?.position());
window.addEventListener('scroll', () => activeHelp?.position(), true);
document.addEventListener('pointerdown', (event) => {
  if (activeHelp && !activeHelp.contains(event.target)) activeHelp.close();
});
document.addEventListener('focusin', (event) => {
  if (activeHelp && !activeHelp.contains(event.target)) activeHelp.close();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') activeHelp?.close();
});

// Top layer evita recorte por cartões e não ocupa espaço no formulário.
export function appendFieldHelp(host, text, label) {
  if (!text) return;
  const control = host.querySelector('input, select, textarea');
  if (control && !control.hasAttribute('aria-label')) control.setAttribute('aria-label', label);
  const heading = host.querySelector(':scope > span') || host;
  const row = document.createElement('div');
  row.className = 'engine-field-heading';
  if (heading !== host) { heading.replaceWith(row); row.appendChild(heading); }
  else host.prepend(row);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'engine-help__trigger';
  button.textContent = 'i';
  button.setAttribute('aria-label', `Ajuda: ${label}`);
  button.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('div');
  panel.id = `engine-help-${++nextHelpId}`;
  panel.className = 'engine-help__panel';
  panel.textContent = text;
  panel.hidden = true;
  panel.setAttribute('role', 'tooltip');
  panel.setAttribute('popover', 'manual');
  button.setAttribute('aria-controls', panel.id);
  button.setAttribute('aria-describedby', panel.id);
  row.appendChild(button);
  row.after(panel);
  let pinned = false;
  let hovered = false;
  let focused = false;
  let closeTimer;
  let dismissed = false;
  const position = () => {
    if (!button.isConnected) { controller.close(); return; }
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const anchor = button.getBoundingClientRect();
    if (anchor.bottom < 0 || anchor.top > viewportHeight) { controller.close(); return; }
    const width = Math.min(352, viewportWidth - 24);
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${Math.max(80, viewportHeight - 24)}px`;
    const height = panel.getBoundingClientRect().height;
    const left = Math.max(12, Math.min(anchor.right - width, viewportWidth - width - 12));
    const preferredTop = anchor.bottom + 8 + height <= viewportHeight - 12 ? anchor.bottom + 8 : anchor.top - height - 8;
    panel.style.left = `${left}px`;
    panel.style.top = `${Math.max(12, Math.min(preferredTop, viewportHeight - height - 12))}px`;
  };
  const controller = {
    position,
    contains: (target) => button.contains(target) || panel.contains(target),
    close() { clearTimeout(closeTimer); dismissed = true; pinned = hovered = focused = false; update(); },
  };
  const update = () => {
    const visible = pinned || hovered || focused;
    if (visible) {
      if (activeHelp && activeHelp !== controller) activeHelp.close();
      panel.hidden = false;
      if (typeof panel.showPopover === 'function') {
        if (!panel.matches(':popover-open')) panel.showPopover();
      } else {
        // Fallback para navegadores sem top layer.
        const style = getComputedStyle(button);
        for (const key of ['--color-panel-alt', '--color-text', '--color-border-strong']) panel.style.setProperty(key, style.getPropertyValue(key));
        document.body.appendChild(panel);
      }
      activeHelp = controller;
      position();
    } else {
      if (typeof panel.hidePopover === 'function' && panel.matches(':popover-open')) panel.hidePopover();
      panel.hidden = true;
      if (panel.parentElement === document.body) row.after(panel);
      if (activeHelp === controller) activeHelp = null;
    }
    button.setAttribute('aria-expanded', String(!panel.hidden));
  };
  const enter = () => { clearTimeout(closeTimer); if (dismissed) return; hovered = true; update(); };
  const leave = () => { closeTimer = setTimeout(() => { dismissed = false; hovered = false; update(); }, 150); };
  button.addEventListener('mouseenter', enter);
  button.addEventListener('mouseleave', leave);
  panel.addEventListener('mouseenter', enter);
  panel.addEventListener('mouseleave', leave);
  button.addEventListener('focus', () => { if (dismissed) return; focused = true; update(); });
  button.addEventListener('blur', () => { focused = false; if (!pinned) dismissed = false; update(); });
  button.addEventListener('click', (event) => {
    event.preventDefault();
    if (pinned) { controller.close(); return; }
    pinned = true;
    dismissed = false;
    focused = false;
    hovered = false;
    update();
  });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { controller.close(); event.preventDefault(); }
  });
}
