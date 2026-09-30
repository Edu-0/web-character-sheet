// engine/layout.js
// Carrega e expõe o "layout.json": como as abas/seções/containers/componentes da ficha
// devem ser organizadas na tela para um dado sistema. Puramente descritivo —
// não contém nenhuma regra de RPG.
let currentLayout = null;

export async function loadLayout(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível carregar o layout (${url}): HTTP ${res.status}`);
  currentLayout = await res.json();
  return currentLayout;
}

export function setLayout(layout) {
  currentLayout = layout;
  return currentLayout;
}

export function getLayout() {
  return currentLayout;
}

export function getTabs() {
  return currentLayout?.tabs ?? [];
}
