import { exportLibrary, readLibraryBackup, backupConflicts, restoreLibrary } from './library-backup.js';
import { recoveryEntries } from './persistence.js';
import { downloadJson } from './storage.js';
import { openModal, confirmDialog } from './modal.js';
import { notify } from './notifications.js';

export function initBackupControls({ getCurrentCharacter, onRestored }) {
  const filename = () => `biblioteca-rpg-${new Date().toISOString().slice(0,10)}.json`;
  document.getElementById('btn-export-library').addEventListener('click', () => {
    try { downloadJson(exportLibrary(getCurrentCharacter()), filename()); notify('Biblioteca exportada, incluindo a ficha em memória.'); }
    catch (error) { notify(error.message, {type: 'error'}); }
  });
  document.getElementById('btn-export-recovery').addEventListener('click', () => {
    try { downloadJson({schemaVersion: 1, kind: 'rpg-storage-recovery', entries: recoveryEntries()}, 'recuperacao-rpg.json'); }
    catch (error) { notify(error.message, {type: 'error'}); }
  });
  const input = document.getElementById('input-import-library');
  document.getElementById('btn-import-library').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const [file] = input.files;
    input.value = '';
    if (!file) return;
    try {
      const data = await readLibraryBackup(file);
      const conflicts = backupConflicts(data, getCurrentCharacter());
      const content = document.createElement('div');
      const summary = document.createElement('p');
      summary.textContent = `${data.characters.length} personagem(ns), ${data.systems.length} sistema(s) importado(s). Conflitos: ${conflicts.characters} personagem(ns), ${conflicts.systems} sistema(s).`;
      const label = document.createElement('label'); label.className = 'field';
      const title = document.createElement('span'); title.textContent = 'Como restaurar';
      const select = document.createElement('select'); select.id = 'backup-restore-mode';
      for (const [value,text] of [['merge', 'Mesclar e preservar existentes'], ['overwrite', 'Mesclar e substituir conflitos'], ['replace', 'Substituir a biblioteca inteira']]) {
        const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
      }
      label.append(title, select);
      const note = document.createElement('p'); note.textContent = 'Mesclar preserva suas fichas e preferências existentes. Substituições pedem confirmação e baixam uma cópia da biblioteca atual antes da restauração.';
      content.append(summary, label, note);
      let busy = false;
      const close = openModal({title: 'Restaurar biblioteca', contentEl: content, actions: [
        {label: 'Cancelar', className: 'button button--ghost'},
        {label: 'Restaurar', closeOnClick: false, onClick: async () => {
          if (busy) return;
          busy = true;
          const choice = select.value;
          close();
          try {
            const replacing = choice !== 'merge';
            if (replacing && !await confirmDialog('Esta operação substitui dados existentes. Uma cópia da biblioteca atual será baixada antes da alteração. Continuar?', {title: 'Confirmar restauração', confirmLabel: 'Substituir dados'})) return;
            if (replacing) downloadJson(exportLibrary(getCurrentCharacter()), `antes-restauracao-${filename()}`);
            const result = await restoreLibrary(data, {mode: choice === 'replace' ? 'replace' : 'merge', overwriteConflicts: choice === 'overwrite', confirmed: replacing, currentCharacter: getCurrentCharacter()});
            await onRestored();
            notify(`Biblioteca restaurada: ${result.characters} personagem(ns).`);
          } catch (error) { notify(error.message, {type: 'error', duration: 10000}); }
          finally { busy = false; }
        }},
      ]});
    } catch (error) { notify(error.message, {type: 'error', duration: 10000}); }
  });
}
