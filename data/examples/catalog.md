# Catálogo e sistemas instalados

**Sistemas** mostra sua biblioteca instalada. **Catálogo** reúne as implementações disponíveis nesta versão do aplicativo, com busca por nome ou ID. Use **Instalar** para acrescentar um sistema à biblioteca; isso não cria personagens. **Ver em Sistemas** leva às ações do pacote instalado. Você também pode importar seus próprios pacotes JSON pelo catálogo ou pela biblioteca.

O catálogo é local e gratuito. Depois da preparação do uso offline, todos os sistemas disponibilizados com o aplicativo podem ser instalados sem conexão. Novos sistemas aparecem no catálogo nas atualizações do app, sem entrar automaticamente na sua biblioteca. Não há servidor, conta, pagamento ou busca de pacotes externos.

Na primeira atualização para esta funcionalidade, os sistemas que antes apareciam sempre na biblioteca são mantidos. A seleção passa a ser salva: excluir um deles não o reinstala ao recarregar ou atualizar o app.

## Editar um sistema instalado

Em **Sistemas → Editar pacote**, abra o [editor JSON com prévia](editor-json.md). A instalação do catálogo é uma cópia local editável, com o mesmo ID do sistema. Para os sistemas já existentes, essa cópia é materializada ao abrir a edição. O original do catálogo permanece nos arquivos do aplicativo e não é alterado.

Alterar o texto do editor não muda a instalação imediatamente. Valide, atualize o ensaio e use **Aplicar pacote**, revisando a confirmação. O preflight protege a base que foi aberta, verifica todos os personagens vinculados e bloqueia substituições incompatíveis ou mudanças concorrentes. Não existe migração automática dos personagens. Extras e valores explícitos continuam sujeitos aos mesmos contratos do editor.

**Editar cópia** continua disponível para criar uma variante com outro ID. Em D&D, a ficha estática permanece como referência; a apresentação modular usa os layouts e regras declarativas do pacote instalado.

Atualizações do catálogo não substituem suas cópias editáveis. Exporte o pacote para compartilhá-lo ou guardá-lo. Para voltar ao original, exporte o que quiser preservar, exclua o sistema e reinstale-o pelo catálogo. Essa exclusão também apaga os personagens vinculados; não há um botão de restauração das regras que preserve automaticamente fichas incompatíveis.

## Excluir sistema e personagens

Use **Excluir sistema** no cartão da biblioteca. A confirmação informa o número e os nomes dos personagens afetados, inclusive documentos indisponíveis cujo sistema possa ser identificado. Cancelar preserva a biblioteca. Confirmar exclui juntos o pacote local, a instalação no catálogo, os documentos vinculados, suas entradas do índice, a seleção de layout e o contexto ativo relacionado.

Exporte seus dados antes de confirmar se quiser guardá-los. O sistema disponível no catálogo pode ser reinstalado, mas seus personagens excluídos não retornam. Pacotes próprios precisam do JSON original para reinstalar. Rascunhos do editor, backups já baixados e recuperações anteriores permanecem separados da exclusão.

Uma biblioteca sem sistemas é permitida. O app mostra o catálogo; **Novo personagem** pede a instalação de um sistema, sem recriar D&D automaticamente.

A exclusão usa a coordenação comum e uma transação com rollback. Listas longas têm rolagem no diálogo e mantêm os botões acessíveis, com foco contido por Tab/Shift+Tab e cancelamento por Escape. Se a biblioteca mudar durante a confirmação, revise e confirme novamente. Documentos sem identificação confiável bloqueiam a exclusão para evitar apagar o conjunto errado. Coleções corrompidas precisam de recuperação. Se a seleção do catálogo impedir a inicialização, Configurações permanece visível para baixar a recuperação original; ela não é sobrescrita automaticamente. A operação exige Web Locks, BroadcastChannel e verificação dos clientes pelo service worker; feche/reabra versões antigas do app e prepare seu uso offline quando a mensagem solicitar.

Se outra aba excluir a ficha enquanto você tiver uma edição não salva, a edição permanece em memória com aviso. Use **Exportar edição em memória** e depois **Sair da ficha removida**. O autosave não recria o personagem removido. Não há sincronização automática nem mescla de edições entre abas.

## Backup da biblioteca

**Exportar tudo** inclui a seleção do catálogo em `catalogSystems` e as cópias locais editáveis entre os pacotes de `systems`. Os originais intactos não precisam ser duplicados no arquivo. Rascunhos continuam com download próprio, fora deste backup.

- **Mesclar** une os sistemas do catálogo do backup à seleção atual e preserva os existentes; a escolha de substituir conflitos afeta os pacotes/personagens conforme a confirmação.
- **Substituir a biblioteca inteira** usa a seleção do backup, inclusive uma lista vazia.
- Backups anteriores sem `catalogSystems` preservam a seleção atual e habilitam os sistemas conhecidos referenciados pelos personagens importados.

IDs de catálogo ainda desconhecidos nesta versão são preservados na seleção e aparecem indisponíveis. Não se presume que qualquer versão antiga possa renderizar sistemas futuros. A importação de JSON não pode criar um pacote com ID reservado sem uma instalação/cópia local autorizada; um backup com cópia de catálogo deve incluir esse ID na sua seleção.

O uso offline depende da preparação inicial e dos dados mantidos pelo navegador. Consulte [instalação e limites](offline.md).
