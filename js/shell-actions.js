export function initShellActions() {
  const trigger = document.getElementById('btn-more');
  const commands = document.getElementById('secondary-actions');
  const compact = matchMedia('(max-width: 900px)');
  function close({ restore = false } = {}) {
    commands.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (restore) trigger.focus();
  }
  trigger.addEventListener('click', () => {
    const open = trigger.getAttribute('aria-expanded') !== 'true';
    trigger.setAttribute('aria-expanded', String(open));
    commands.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
      event.preventDefault(); close({ restore: true });
    }
  });
  document.addEventListener('click', event => {
    if (!commands.contains(event.target) && !trigger.contains(event.target)) close({ restore: commands.contains(document.activeElement) });
  });
  commands.addEventListener('click', event => {
    if (event.target.closest('button') && compact.matches) close({ restore: true });
  });
  document.addEventListener('focusin', event => {
    if (!commands.contains(event.target) && event.target !== trigger) close();
  });
  compact.addEventListener('change', () => close({ restore: compact.matches && commands.contains(document.activeElement) }));
  // O cabeçalho pode crescer com nomes e zoom. Offsets acompanham sua altura real.
  const header = document.querySelector('.shell-header');
  new ResizeObserver(() => document.documentElement.style.setProperty('--shell-height', `${header.getBoundingClientRect().height}px`)).observe(header);
}
