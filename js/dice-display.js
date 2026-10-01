import { DICE_PATHS, RULE_PATHS } from '../assets/artwork/book-vectors.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function glyph(pathData, viewBox, className, strokeWidth) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('stroke-linecap', 'round');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  return svg;
}

export function createDiceGlyph(sides) {
  return DICE_PATHS[sides] ? glyph(DICE_PATHS[sides], '0 0 200 200', 'dice-glyph', 9) : null;
}

export function createRuleGlyph(name) {
  return RULE_PATHS[name] ? glyph(RULE_PATHS[name], '0 0 24 24', 'rule-glyph', 1.6) : null;
}

// O texto continua disponível; dados sem arte conhecida usam somente dN.
export function createDiceLabel(dice) {
  const label = document.createElement('span');
  label.className = 'dice-display';
  dice.forEach((sides, index) => {
    if (index) label.append(' + ');
    const part = document.createElement('span');
    part.className = 'dice-display__part';
    const icon = createDiceGlyph(sides);
    if (icon) part.appendChild(icon);
    part.append(`d${sides}`);
    label.appendChild(part);
  });
  if (!dice.length) label.append('—');
  return label;
}

export function createDiceIllustration(dice) {
  const preview = document.createElement('span');
  preview.className = 'trait-illustration';
  preview.setAttribute('aria-hidden', 'true');
  dice.forEach((sides, index) => {
    const icon = createDiceGlyph(sides);
    if (!icon) return;
    if (index && preview.children.length) preview.append(' + ');
    preview.appendChild(icon);
  });
  return preview;
}
