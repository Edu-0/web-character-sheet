// icons.js
// Pequeno conjunto de ícones SVG inline (sem dependências externas).
const icon = (path, viewBox = '0 0 24 24') =>
  `<svg viewBox="${viewBox}" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const icons = {
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  trash: icon('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  chevron: icon('<path d="M6 9l6 6 6-6"/>'),
  edit: icon('<path d="M4 20h4L18 10l-4-4L4 16v4z"/>'),
  upload: icon('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'),
  dice: icon('<path d="M4 4h16v16H4z"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/>'),
  sun: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: icon('<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>'),
  download: icon('<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>'),
  close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
  arrowUp: icon('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  arrowDown: icon('<path d="M12 5v14M5 12l7 7 7-7"/>'),
  shield: icon('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/>'),
  heart: icon('<path d="M12 20s-7-4.4-9.5-9C1 7.5 2.5 4 6 4c2 0 3.4 1.2 4 2.3C10.6 5.2 12 4 14 4c3.5 0 5 3.5 3.5 7-2.5 4.6-9.5 9-9.5 9z"/>'),
  search: icon('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  image: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5.5-5.5L9 18"/>'),
};
