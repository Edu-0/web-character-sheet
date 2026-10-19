# Criar e editar um sistema

Em **Sistemas**, escolha **Criar pacote**, importe um arquivo ou abra a edição de um sistema instalado. O editor organiza o trabalho em seis áreas. Você pode alternar entre elas livremente; não precisa concluir um assistente nem acrescentar regras automáticas para montar uma ficha preenchível.

| Área | O que fazer |
| --- | --- |
| **Visão geral** | Dar nome ao sistema e escolher por onde começar |
| **Ficha** | Montar o layout, selecionar componentes e alterar sua apresentação |
| **Dados** | Definir valores do personagem, registros, coleções, catálogos e compostos |
| **Regras** | Configurar cálculos, condições, ações, eventos, efeitos e criação/evolução |
| **Testar** | Experimentar a ficha com uma amostra isolada |
| **Revisar** | Corrigir pendências, conferir o ensaio e revisar o impacto antes de aplicar |

## Começar pela ficha

Um pacote novo abre em Visão geral, com a estrutura inicial vazia. Altere **Nome do sistema** e use **Aplicar nome** quando quiser confirmar esse campo. **Monte a ficha** leva à composição. **Adicionar primeiro elemento** abre as ferramentas de inclusão; começar pelos dados também é possível.

Ao escolher **Adicionar primeiro elemento**, o formulário abre no centro, com a configuração já visível. Escolha **O que adicionar**, preencha **Nome mostrado na ficha** e clique em **Revisar inclusão**, no formulário ou no cabeçalho. Confira o resumo e use **Confirmar alteração** para incluir. **Cancelar** volta à configuração sem criar o elemento. Ao confirmar, a ficha aparece com o novo elemento selecionado. **Voltar à ficha vazia** conserva a configuração no rascunho para continuar depois.

Em Ficha, a lateral alterna entre **Estrutura**, **Adicionar** e **Layouts**. A primeira mostra os blocos da ficha; a segunda oferece busca, elementos e configuração; a terceira reúne os layouts do sistema. Escolha o destino antes de incluir ou mover um elemento. Campos simples podem ser arrastados; configurações com dependências usam a revisão de inclusão existente.

Ao trocar o layout exibido, as propriedades e o destino de inclusão acompanham esse layout. Textos pendentes de outros layouts permanecem guardados até aplicar ou descartar cada campo.

Selecionar um elemento abre suas propriedades. Os campos mais usados aparecem primeiro. Os grupos recolhidos indicam quando contêm opções configuradas; abri-los permite editar os demais parâmetros. Os grupos mantêm sua abertura ao aplicar outras edições na mesma sessão do editor. Voltar de Testar conserva também a seleção de Sistema ou Pacote quando você estiver editando esses blocos. As ações do elemento reúnem duplicação, movimento e remoção com revisão de impacto. **Mostrar na ficha** revela a seleção.

Durante a composição, os controles da amostra servem para selecionar definições. Para executar ações de jogo, abra Testar. Arrasto tem alternativas por controles de destino e movimento; não é obrigatório para criar uma ficha.

## Menu do elemento e atalhos

Em **Ficha**, clique com o botão direito em um elemento da prévia ou da árvore. O menu oferece propriedades, localização na ficha, duplicação, remoção e acesso à definição no JSON. **Shift F10** abre o mesmo menu para a seleção. Duplicar e remover respeitam as pendências e confirmações existentes; remover uma apresentação não apaga automaticamente seus dados ou regras compartilhados.

| Tecla | Ação |
| --- | --- |
| Delete | Revisar remoção do elemento selecionado |
| Ctrl/⌘ D | Duplicar a seleção |
| F2 | Focar o nome/rótulo da seleção |
| A ou Insert | Adicionar elemento |
| P | Abrir propriedades |
| Ctrl/⌘ Z | Desfazer no editor |
| Ctrl/⌘ Shift Z ou Ctrl Y | Refazer no editor |
| Ctrl/⌘ S | Salvar o rascunho |
| ? | Consultar os atalhos |
| Esc | Fechar menu ou a janela JSON em foco |

Atalhos de elemento atuam em Ficha, fora de inputs, selects, textareas e editores de texto. Ao digitar, Delete e desfazer continuam editando o texto. Nenhum atalho aplica os campos pendentes. Modais de confirmação bloqueiam os atalhos do editor. Teclas reservadas pelo navegador ou sistema dependem do ambiente e não são substituídas pelo aplicativo. A lista também está em **Código e propriedades → Atalhos do editor**.

## Acompanhar o JSON enquanto edita

Escolha **Código e propriedades → Acompanhar JSON**, ou a mesma opção no menu do elemento. A janela flutuante permanece aberta enquanto você navega e edita. Arraste o cabeçalho para movê-la ou redimensione pela borda; com o cabeçalho focado, as setas também movem a janela.

O conteúdo é **somente leitura** e acompanha o documento atual, incluindo aplicar campos, confirmar inclusões e desfazer/refazer. Textos pendentes aparecem quando entram no documento. Para editar o arquivo diretamente, continue usando **Editar JSON**. Fechar a janela não altera o pacote.

## Dados e regras

Dados e Regras oferecem uma lista de famílias e um editor central amplo. Um dado pode existir sem componente e ser usado em mais de uma apresentação. Editar uma definição compartilhada afeta seus consumidores; duplicar a apresentação não cria automaticamente um dado independente.

Dados legados, dados tipados, catálogos e compostos mantêm seus próprios contratos. Abrir ou trocar de área não converte versões nem altera os valores. **Ausente**, **zero**, **vazio** e **nulo** continuam distintos. Valores iniciais pertencem ao sistema; valores alterados no ensaio pertencem à amostra.

Regras reúne cálculos e consultas, ações e resoluções, eventos e gatilhos, efeitos, criação/evolução e relações. O grafo e os controles lineares editam os mesmos vínculos. Mover um nó só organiza a vista. A lista de propriedades completas e o JSON continuam disponíveis para configurações avançadas e formatos legados.

## Campos pendentes e histórico

Onde houver **Aplicar campo** e **Descartar texto deste campo**, a alteração só entra no documento ao aplicar. Navegar para outra área, redimensionar ou recolher um grupo não confirma o texto. Receitas e construtores conservam seus próprios comandos de revisão e confirmação.

O estado do rascunho aparece no cabeçalho. Mensagens de erro de configuração não são apagadas pelo salvamento nem pela atualização automática da amostra. Uma nova edição limpa o aviso anterior para você tentar novamente. A revisão e as pendências ficam também no rodapé. Em Revisar, **Localizar campo** retorna à edição correspondente; **Descartar pendência** descarta somente aquele texto ou construtor. JSON, formulários e composição compartilham o histórico da sessão do editor. Desfazer esse histórico não desfaz uma instalação já confirmada na biblioteca.

## Testar e revisar

Testar usa uma amostra fictícia isolada. Escolha o layout e abra **Exibição** para tema e largura. **Atualizar / reiniciar ensaio** monta a revisão atual e recria a amostra; os valores usados no teste não são exportados no pacote nem gravados nos seus personagens. **Conferir leituras e resultados** consulta a amostra corrente. Abrir o ensaio não certifica que o sistema tenha sido testado por pessoas.

Revisar mostra validação, campos pendentes, estado da prévia e migração dos dados instalados quando aplicável. Os controles para localizar os problemas levam à sua origem. **Aplicar sistema…** usa a confirmação e o preflight da biblioteca; pode instalar ou substituir um pacote local. Não publica o sistema.

**Exportar pacote** exige uma revisão válida sem campos pendentes. Aplicar tem requisitos adicionais, como ensaio corrente e revisão de migração quando necessária. **Exportar última versão válida** é uma escolha separada. Consulte [migração e restauração](data-migration.md) antes de mudar dados de sistemas com personagens vinculados.

## Arquivo e métodos técnicos

**Arquivo** reúne salvar o rascunho agora, salvar cópia, baixar rascunho, exportar pacote, exportar última válida, recuperação e saída. O salvamento automático continua ativo. Rascunhos ficam nesta origem do navegador, separados de **Exportar tudo**; baixe uma cópia para transportá-los. Falha de armazenamento preserva o trabalho em memória e oferece saídas de recuperação.

**Código e propriedades** oferece **Editar JSON** e **Editar por formulários**, além de validar, formatar e normalizar aliases quando disponível. O documento, as pendências e as proteções são os mesmos. Versões futuras ou texto incompatível permanecem preservados. Consulte os guias de [JSON](editor-json.md), [formulários](editor-forms.md), [componentes](components-reference.md) e [autoria visual](editor-visual.md) para os contratos específicos.

## Telas menores

Em telas amplas, ficha e ferramentas compartilham a altura disponível. As laterais rolam separadamente: rolar as ferramentas não desloca a ficha. O feedback dos campos mantém a posição em que você está trabalhando. Em larguras intermediárias, uma lateral aparece por vez. No celular, alterne **Ficha**, **Ferramentas** e **Propriedades**; Dados/Regras permitem voltar à lista de famílias. O seletor **Área** mantém os seis destinos acessíveis. Durante a autoria, a navegação principal dá lugar ao cabeçalho do editor; **Voltar a Sistemas** e **Arquivo** oferecem as saídas. Os controles se reorganizam com a ampliação, e o menu do elemento e a janela JSON permanecem limitados à janela disponível.

No método técnico, os painéis JSON/propriedades e prévia continuam acessíveis. No computador, **Divisão JSON / prévia** fica acima dos painéis e ajusta suas larguras. No celular, volte ao painel **Prévia** para usar **Mostrar na prévia**, ou use **Alt Enter** a partir do JSON. Escape fecha menus e confirmações apropriadas, com retorno ao controle de origem. Sair do editor preserva as verificações de salvamento e conflito existentes.

## Uso em telas menores e pacotes antigos

No celular, as ações do cabeçalho e a seleção de área ocupam uma linha cada. O menu **Código e propriedades** aparece abreviado como **Código**, mantendo os mesmos comandos. Pendências têm aviso curto no cabeçalho e detalhes em **Revisar**.

Abrir o menu de um elemento por botão direito ou Shift F10 mantém o painel de origem visível. **Editar propriedades** leva ao inspector; Escape fecha o menu e retorna o foco à ficha ou à estrutura. O menu não altera o documento.

Em pacotes v1/v2, **Cálculos e consultas** explica o requisito dos cálculos visuais e oferece **Configurar dados tipados**. Esse botão apenas navega até Dados. **Habilitar dados tipados (v3)** continua exigindo a revisão e a confirmação existentes; as fórmulas antigas permanecem acessíveis em **Regras e propriedades completas**.
