// Draft UI only: the list owns validation and the existing character write path.
export function openEntryEditor({owner, title, item, context, renderField, onSave, returnFocus, bindingKey, adding = false}) {
  const original = structuredClone(item);
  const draft = structuredClone(item);
  const dialog = document.createElement('dialog');
  dialog.className = 'engine-entry-editor';
  const heading = document.createElement('h2');
  heading.id = 'entry-editor-' + crypto.randomUUID();
  heading.textContent = title;
  dialog.setAttribute('aria-labelledby', heading.id);
  const note = document.createElement('p');
  note.textContent = 'As alterações serão aplicadas ao salvar.';
  note.className = 'engine-entry-editor__note';
  const form = document.createElement('div');
  form.className = 'engine-entry-editor__form';
  const fields = document.createElement('div');
  fields.className = 'engine-entry-editor__fields';
  const draftContext = {...context, registerRefresh: undefined, onChange: () => {}};
  for (const [key, definition] of Object.entries(context.itemSchema || {})) {
    fields.append(renderField(draft, key, definition, draftContext, () => {}));
  }
  const feedback = document.createElement('p');
  feedback.className = 'engine-entry-editor__feedback';
  feedback.setAttribute('role', 'alert');
  const footer = document.createElement('footer');
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.className = 'button button--ghost'; cancel.textContent = 'Cancelar';
  const save = document.createElement('button');
  save.type = 'button'; save.className = 'button button--primary'; save.textContent = 'Salvar';
  footer.append(cancel, save); form.append(fields, feedback, footer); dialog.append(heading, note, form);
  let unregister;
  const close = () => {
    dialog.close(); dialog.remove(); unregister?.();
    const target = returnFocus?.();
    if (target?.isConnected) target.focus();
  };
  cancel.addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('input, select, textarea, button')].filter(control => !control.disabled && control.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  save.addEventListener('click', () => {
    for (const control of fields.querySelectorAll('input, select, textarea')) if (!control.reportValidity()) return;
    try {
      if (!owner?.isConnected) throw new Error('A lista não está disponível na ficha atual. Seu rascunho continua nesta janela para consulta ou cópia.');
      onSave(draft, original, item);
      close();
    } catch (error) { feedback.textContent = error.message; }
  });
  // The modal belongs to this renderer, including an isolated preview iframe.
  document.body.append(dialog);
  if (context.entryEditors) {
    unregister = context.entryEditors.track(bindingKey, {close,
      bind(binding) {
        owner = binding?.owner;
        if (binding) {
          onSave = adding ? binding.add : binding.edit;
          returnFocus = () => binding.focus(item.id);
          feedback.textContent = '';
        } else {
          returnFocus = undefined;
          feedback.textContent = 'A ficha mudou. O rascunho continua aqui; só será aplicado se a lista continuar disponível.';
        }
      },
    });
  } else unregister = context.registerCleanup?.(() => { dialog.close(); dialog.remove(); });
  dialog.showModal();
  (fields.querySelector('input, textarea, select') || fields.querySelector('button'))?.focus();
  return close;
}
