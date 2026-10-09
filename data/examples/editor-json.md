# Editor JSON com prévia

Sistemas instalados pelo [Catálogo](catalog.md) também oferecem **Editar pacote**, com o mesmo ID, em uma cópia local; o original do catálogo permanece intacto. **Editar cópia** cria uma variante com outro ID. Aplicar a edição verifica a base e os personagens vinculados antes de substituir a instalação.

Em **Sistemas**, escolha **Criar pacote**, **Abrir JSON**, **Editar cópia** em um sistema embutido ou **Editar pacote** em um importado. Abrir apenas inicia a edição; **Aplicar pacote** instala as regras na biblioteca local depois de uma confirmação.

O texto JSON é a fonte da edição. **Editar por formulários** oferece árvore e inspector sobre a mesma sessão; consulte a [cobertura por família](editor-forms.md). Erros de sintaxe, chaves duplicadas, números que perderiam precisão e erros de contrato aparecem em **Diagnósticos**. Clique para ir ao trecho correspondente. Texto inválido continua editável, salvável como rascunho e baixável. **Formatar JSON**, **Normalizar aliases** e **Restaurar última válida** são comandos explícitos e podem ser desfeitos. A normalização conserva um original baixável.

**Desfazer JSON / Refazer JSON** ou Ctrl/⌘ Z e Ctrl/⌘ Shift Z operam no texto, independentemente do personagem. O histórico dura somente na sessão aberta: até 50 operações e 8 MiB estimados de strings antes/depois. Edições muito grandes encerram operações anteriores, com aviso, sem truncar o texto. Tab sai da textarea; colagem e composição de texto são preservadas.

## Experimentar o pacote

**Atualizar / reiniciar ensaio** monta o layout escolhido com um personagem fictício derivado do template. Você pode editar campos, rolar, testar ações, custos e recuperações compatíveis. Essas alterações são efêmeras: não entram no JSON, no rascunho ou nos personagens da biblioteca. A prévia tem seu próprio contexto de regras, eventos, modais e rolagens, em um frame de origem opaca, sem acesso à ficha ou ao armazenamento do aplicativo.

Escolha layout, tema e largura para experimentar a apresentação. No celular, alterne **JSON / Diagnósticos / Prévia**. Após editar o texto, a prévia anterior fica sinalizada como desatualizada até o próximo comando de atualização. Uma falha de montagem conserva o último ensaio bem-sucedido. A prévia aceita imagens embutidas em Data URL e uploads locais; imagens por URL e acesso à rede ficam bloqueados. Ela não executa scripts do pacote.

Os oito sistemas embutidos e seus layouts podem ser ensaiados. Uma cópia D&D recebe um novo ID e oferece os componentes modulares; estática e comparação continuam associadas ao D&D original. Mecânicas novas exigem suporte da engine. O editor também oferece [formulários](editor-forms.md); toolbox, arrasto e impressão da prévia continuam fora do escopo.

## Navegar entre JSON e prévia

Ative **Localizar no JSON** e clique ou toque em qualquer texto, campo ou botão da prévia. O editor seleciona e rola até o objeto completo do componente, em vez de uma propriedade interna. Títulos, abas e espaços de um container apontam para seu próprio bloco; o cabeçalho aponta para o nome do sistema ou para o template. Listas apontam para sua definição externa, inclusive ao tocar numa entrada. Ajuda e modais apontam para o componente de origem.

Enquanto esse modo estiver ativo, cliques/toques localizam sem executar ações ou editar campos do ensaio. Pelo teclado, use **Tab** e **Enter** (ou Espaço) no elemento. **Escape**, dentro da prévia, desativa o modo; o botão também o alterna. Fora dele, cliques e duplos cliques mantêm a interação normal.

No sentido inverso, posicione o cursor no JSON e use **Mostrar na prévia** ou **Alt+Enter**. A prévia abre a aba correspondente, rola até o elemento e destaca suas ocorrências. Uma definição com `repeat` destaca todos os componentes que ela gerou; cada ocorrência leva ao mesmo objeto original. No celular, o painel alterna automaticamente nos dois sentidos. Nenhum desses comandos altera o texto, formata o pacote ou cria uma operação de desfazer.

A navegação exige a prévia da revisão e do layout atuais. Depois de editar, use **Atualizar / reiniciar ensaio**; uma prévia antiga não aponta para offsets potencialmente errados. Regras, fórmulas e extras sem representação direta nesse layout não têm alvo visual automático. Uma repetição vazia pode ter definição JSON e nenhum elemento renderizado, caso informado pelo editor.

## Recuperar e exportar

Rascunhos são salvos automaticamente nesta origem do navegador; **Salvar rascunho** confirma uma gravação manual. Eles ficam listados em Sistemas. Reabrir recupera texto, última válida e apresentação do editor, com histórico reiniciado. Rascunhos corrompidos ou futuros conservam seu bruto baixável. Conflitos entre abas e falhas de armazenamento preservam o texto em memória; use **Salvar rascunho como cópia** ou **Baixar rascunho**.

**Exportar tudo não inclui rascunhos.** Baixe-os separadamente. **Abrir JSON** também abre um envelope de rascunho baixado como nova cópia local, sem instalar o sistema. Limpar os dados do site ou mudar de navegador/endereço pode apagar o acesso aos rascunhos. Ao sair com texto não salvo, escolha salvar, baixar, descartar desde o último salvamento ou continuar editando. Fechar a janela não garante uma gravação pendente.

**Exportar pacote** exige a revisão atual válida e gera o formato aceito por **Importar sistema**. **Exportar última versão válida** é uma ação distinta; sua revisão aparece no cabeçalho e no resultado da exportação. Nenhuma inclui o personagem de ensaio. Pacotes têm limite de 4 MiB; envelopes de recuperação, 20 MiB, sujeitos também à quota do navegador. Não há truncamento automático.

## Aplicar na biblioteca

Aplicar exige contrato válido e ensaio bem-sucedido da revisão/layout atuais. A confirmação informa instalação/substituição, ID, personagens vinculados, avisos, layouts removidos e recuperação do pacote anterior. IDs embutidos são protegidos. Alterar o ID manualmente cria outro pacote e não migra personagens.

O mesmo serviço usado pela importação relê a biblioteca e valida os vinculados, inclusive o ativo em memória. Mudanças concorrentes, vinculados indisponíveis e revisões de efeitos incompatíveis impedem a gravação. Não há merge automático. Escritores atuais compartilham coordenação entre abas; uma janela antiga, sem resposta ou sem coordenação bloqueia a substituição. Feche e reabra essas janelas antes de repetir.

Um documento corrompido ou ausente conserva a identificação do índice para esse preflight. Se um documento indisponível não puder ser associado a um sistema, a substituição fica bloqueada até preservar/corrigir o original. Você pode continuar editando e exportando o pacote.

A gravação confirmada usa journal/rollback e conserva uma cópia recuperável do pacote substituído. Remontar a ficha após aplicar não materializa novos defaults, listas ou migrações no personagem. Abrir normalmente uma ficha depois continua seguindo os contratos existentes. Desfazer JSON após aplicar altera somente o rascunho; restaurar a biblioteca exige outra aplicação confirmada. Falha posterior de remontagem aparece como **pacote salvo, ficha não remontada**.

O editor e o runtime da prévia são arquivos locais incluídos na preparação [offline](offline.md), inclusive em subpastas. O build usa esbuild fixado como dependência de desenvolvimento; o navegador não depende de npm, CDN ou rede. Consulte também [validação e preservação](validation.md) e [contratos dos componentes](components-reference.md).
