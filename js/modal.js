// modal.js
// Sistema genérico de modais, incluindo confirmação para ações destrutivas.
const overlay = document.createElement('div');
overlay.className = 'modal-overlay';
overlay.setAttribute('hidden', '');

const modalBox = document.createElement('div');
modalBox.className = 'modal';
modalBox.setAttribute('role', 'dialog');
modalBox.setAttribute('aria-modal', 'true');
overlay.appendChild(modalBox);

let lastFocused = null;
let activeCloseHandler = null;

function mountOverlay() {
  if (!overlay.isConnected) document.body.appendChild(overlay);
}

function close() {
  overlay.setAttribute('hidden', '');
  modalBox.innerHTML = '';
  document.removeEventListener('keydown', onKeydown);
  if (lastFocused) lastFocused.focus();
  activeCloseHandler = null;
}

function onKeydown(e) {
  if(e.key==='Tab' && modalBox.querySelector('.system-removal-review')){
    const controls=[...modalBox.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    const first=controls[0],last=controls.at(-1);
    if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
  }
  if (e.key === 'Escape') {
    if (activeCloseHandler) activeCloseHandler();
    close();
  }
}

export function openModal({ title, contentEl, actions = [], onClose }) {
  mountOverlay();
  lastFocused = document.activeElement;
  activeCloseHandler = onClose || null;

  modalBox.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'modal__header';
  const heading = document.createElement('h2');
  heading.className = 'modal__title';
  heading.textContent = title;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'icon-button modal__close';
  closeBtn.setAttribute('aria-label', 'Fechar');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => {
    if (onClose) onClose();
    close();
  });
  header.appendChild(heading);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal__body';
  body.appendChild(contentEl);

  modalBox.appendChild(header);
  modalBox.appendChild(body);

  if (actions.length) {
    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    actions.forEach((action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = action.className || 'button';
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        action.onClick?.();
        if (action.closeOnClick !== false) close();
      });
      footer.appendChild(btn);
    });
    modalBox.appendChild(footer);
  }

  overlay.removeAttribute('hidden');
  document.addEventListener('keydown', onKeydown);

  const firstInput = modalBox.querySelector('input, textarea, select, button');
  firstInput?.focus();

  return close;
}

export function confirmDialog(message, { title = 'Confirmar ação', confirmLabel = 'Confirmar', messageClass = '' } = {}) {
  return new Promise((resolve) => {
    const content = document.createElement('p');
    content.className = `modal__message ${messageClass}`.trim();
    if(messageClass==='system-removal-review')content.tabIndex=0;
    content.textContent = message;

    openModal({
      title,
      contentEl: content,
      onClose: () => resolve(false),
      actions: [
        {
          label: 'Cancelar',
          className: 'button button--ghost',
          onClick: () => resolve(false),
        },
        {
          label: confirmLabel,
          className: 'button button--danger',
          onClick: () => resolve(true),
        },
      ],
    });
  });
}

export function closeModal() {
  close();
}
