# Plano de refinamento da interface e da impressão/PDF

Preparado em 1º de outubro de 2026. Este documento entrega um prompt de implementação, TODO e ordem de execução. Os itens abaixo são planejamento; sua presença no repositório não autoriza executá-los automaticamente. A implementação começa quando o usuário enviar o prompt ou pedir a execução de uma etapa.

**Execução autorizada e concluída em 1º–2 de outubro de 2026:** as marcações abaixo registram a implementação e as verificações atuais. Consulte o [relatório de resultados](refinamento-design-pdf-resultados.md) para amostras, medições, testes e limites. O diálogo nativo de impressão/cancelamento foi coberto pelo ciclo de eventos, sem interação física; o reflow a 200% foi exercitado pela viewport CSS equivalente. O diagnóstico histórico abaixo permanece como referência anterior à implementação.

**Decisão posterior do usuário:** o PDF deve herdar a identidade da página. A [segunda revisão](design-pdf.md) substitui a apresentação monocromática e a exclusão de ornamentos descritas no prompt original por paleta adaptada ao papel, tipografia, cartões e decoração ativa. Permanecem os critérios de conteúdo completo, paginação fluida e preservação do estado. O prompt abaixo registra o escopo original.

## 1. Prompt pronto para usar

Copie o bloco abaixo para iniciar a implementação. Para executar apenas parte do trabalho, substitua a frase de escopo por "Execute somente a etapa N".

```text
Implemente o refinamento de qualidade da interface e da impressão/exportação
para PDF deste projeto, seguindo docs/plano-refinamento-design-pdf.md.
Execute as etapas 0 a 6, em ordem, até concluir os critérios de aceite.

Objetivo: tornar a ficha mais fácil de consultar durante uma sessão, compactar
o celular, organizar as Configurações e produzir um PDF legível, com bom
aproveitamento das páginas e sem cortes de conteúdo. Preserve a identidade
das paletas e use as artes autorais já selecionadas de maneira consistente.

Antes de editar:
- Leia AGENTS.md, README.md e a documentação disponível pertinente.
- Confira git status e os arquivos reais; preserve alterações do usuário.
- Se algum documento citado não existir, registre a ausência e continue com
  as fontes disponíveis. Não invente decisões nem reconstrua documentação
  histórica para preencher essa lacuna.
- Faça uma comparação inicial com fichas vazias e preenchidas, no celular,
  no desktop e no PDF real. Registre limitações da verificação.

Escopo da interface:
1. Compactar o cabeçalho no celular, reunindo ações secundárias em "Mais".
2. Reduzir o espaço vazio do cabeçalho/nome do personagem.
3. Integrar os ornamentos às extremidades do cabeçalho, com espaço reservado.
4. Separar Configurações em Cores, Dados e Ornamentos; permitir recolher
   famílias e manter uma prévia próxima aos controles.
5. Reduzir bordas e caixas aninhadas; definir hierarquia clara entre títulos,
   rótulos, valores, notas e ações.
6. Padronizar tipografia e tamanho/peso aparente dos vetores.

Escopo da impressão/PDF:
- Criar uma apresentação própria para papel A4, branca e legível, independente
  do tema da tela e da opção de imprimir fundos.
- Imprimir os dados atuais do personagem, incluindo abas não selecionadas,
  cartões recolhidos e itens que filtros da tela tenham escondido.
- Substituir controles por valores de leitura. Retirar ações, placeholders,
  formulários de criação/evolução/rolagem e outros elementos operacionais.
- Preservar descrições completas, retrato quando existente, estados, recursos,
  coleções, dados compostos, valores calculados determinísticos e registros
  relevantes já armazenados. Não imprimir uma rolagem nova ou cobrar custos.
- Organizar títulos, tabelas, quebras, margens e identificação das páginas.
  Evitar páginas vazias, títulos isolados e seções longas cortadas.
- Imprimir apenas uma ficha no modo de comparação. O conteúdo deve ser
  equivalente nas apresentações D&D estática e modular.
- Atender ao botão de impressão e ao Ctrl/Cmd+P. Cancelar ou repetir a impressão
  não pode alterar personagem, preferências, aba ativa, filtros ou apresentação.
- Manter a exportação JSON funcionando como backup independente do PDF.

Invariantes:
- Preserve a referência D&D estática, a modular e a comparação sincronizada.
- Separe sistema, layout, personagem e preferências de aparência. Reutilize
  componentes quando as regras forem compatíveis.
- Preserve as seis paletas, os modos claro/escuro, os nove ornamentos, suas
  combinações/posições/intensidade e as escolhas Texto ou Vetor com texto.
- Mantenha os rótulos dN legíveis e fallback textual para dados sem desenho.
- Use somente os assets autorais já selecionados em assets/artwork/; preserve
  proveniência e direitos. Não distribua docs/references/ nem altere a licença.
- Não invente regras, preços de evolução ou decisões narrativas.
- Não acrescente editor visual, arraste livre, novas famílias de arte, backend,
  download automático de PDF ou dependências grandes sem necessidade.

Método:
- Faça mudanças coesas por etapa, com comentários de progresso concisos.
- Resolva escolhas rotineiras dentro desse escopo e registre as decisões.
- Use testes funcionais relevantes e inspeção visual. Testes verdes sozinhos
  não comprovam qualidade de layout ou paginação.
- Verifique PDFs realmente gerados e renderize suas páginas para inspeção;
  emulateMedia('print') sozinho não valida as quebras do arquivo final.
- Não execute suítes concorrentes na porta 4173. Execute a regressão completa
  ao final; repita testes apenas quando mudanças ou falhas justificarem.
- Atualize documentação e testes quando contratos visuais mudarem. Não remova
  verificações de conteúdo/sincronização para acomodar o novo layout.
- Não publique, faça deploy ou commit sem pedido.

Entrega:
- Código implementado, critérios atendidos e documentação atualizada.
- Capturas antes/depois e PDFs de exemplo com dados fictícios para revisão.
- Relato do que mudou, dos testes atuais e das limitações restantes.
- Não declare o trabalho concluído se houver dados cortados, texto ilegível,
  conteúdo omitido ou alterações de estado causadas pela impressão.
```

## 2. Estado de partida e evidências

O projeto já possui seis paletas com claro/escuro, busca na ficha, nove ornamentos opcionais e apresentação dos dados em texto ou vetores acompanhados de texto. Não recriar essas funcionalidades nem tratar este refinamento como uma substituição da aplicação.

### Observado na revisão anterior

- No celular de 360 px, cabeçalho, ações, busca, faixa ornamental e cartão do nome ocupavam grande parte da tela antes dos valores.
- Configurações formava uma página longa, com seis paletas e nove ornamentos empilhados.
- A decoração ficava em uma faixa independente acima do cabeçalho da ficha.
- Havia contornos de peso semelhante em seções, subcartões e controles.
- A prévia de impressão conservava fundos escuros da engine, enquanto alguns valores ficavam pretos.
- Na amostra autoral, 28 botões operacionais permaneciam visíveis no modo de impressão.
- As duas amostras de PDF, com fichas praticamente vazias, tinham oito páginas cada. Esse é um resultado histórico, não uma meta nem uma medição de personagens futuros.

A revisão visual anterior foi da prévia de impressão no navegador. A renderização das páginas dos PDFs pelo Poppler instalado ficou bloqueada pela configuração incompleta do MiKTeX. Não afirmar que a paginação de todas as páginas já foi inspecionada. A próxima execução precisa confirmar isso com um renderizador funcional, sem reconfigurar a instalação pessoal do usuário por conta própria.

### Riscos ainda a reproduzir

- Corte de textos longos: `overflow: visible` não aumenta sozinho a altura de uma textarea.
- Espaços vazios ou corte de seções grandes, por combinação de `break-inside: avoid`, grids e `overflow: hidden`.
- Conteúdo de Configurações/bibliotecas entrando na impressão iniciada fora da ficha.
- Itens filtrados ou cartões recolhidos ficando ausentes de uma exportação baseada apenas na tela visível.
- Duplicação da ficha no modo de comparação, diferenças entre apresentações e perda de estado após cancelar a impressão.

Esses riscos precisam de casos reproduzíveis; não os apresentar como falhas já comprovadas em todos os navegadores.

## 3. Ordem de execução e TODO

| Etapa | Prioridade | Resultado esperado | Depende de |
| --- | --- | --- | --- |
| 0. Diagnóstico e amostras | Alta | Referências antes/depois e casos de conteúdo | Nada |
| 1. Padrões visuais e contratos | Alta | Hierarquia, densidade e contrato da impressão | 0 |
| 2. Impressão/PDF | Crítica | Documento legível e completo, sem alterar a ficha | 1 |
| 3. Cabeçalho e espaço útil | Alta | Consulta mais rápida no celular | 1; conferir compatibilidade com 2 |
| 4. Configurações | Alta | Escolhas fáceis de localizar e experimentar | 1 e 3 |
| 5. Ornamentos e acabamento | Média | Arte integrada, menos caixas e consistência visual | 3 e 4 |
| 6. Verificação e documentação | Alta | Resultado revisado em tela e páginas reais | 2 a 5 |

O PDF vem cedo porque legibilidade e preservação de conteúdo são problemas funcionais. Sua apresentação própria também reduz o risco de cada ajuste de tela exigir um novo reparo na impressão. Verificações locais acontecem em todas as etapas; a etapa 6 reúne a revisão final.

### Etapa 0 — Diagnóstico e amostras

- [x] Conferir o estado atual do repositório, os módulos pertinentes e possíveis mudanças desde esta revisão.
- [x] Registrar capturas de D&D e do sistema autoral em 360, 768 e 1280 px.
- [x] Incluir comparação D&D e Configurações; acrescentar um caso com nome e rótulos longos.
- [x] Preparar fichas fictícias vazias e preenchidas, sem substituir dados reais do usuário.
- [x] Preparar casos com retrato, recurso atual/máximo, inventário extenso, descrições com várias páginas, estados e histórico de evolução.
- [x] Incluir d12 + d6 como uma única fonte, perícias implícitas e um dado sem arte, como d30, em um sistema importado de teste.
- [x] Gerar PDFs de referência e registrar quantidade de páginas, conteúdo esperado e limites da inspeção.
- [x] Confirmar os riscos listados acima e separar falha reproduzida de suspeita.

**Saída:** amostras e lista de problemas reproduzíveis, com passos e resultado esperado. Sem mudança de regras.

### Etapa 1 — Padrões visuais e contratos

- [x] Definir escala coerente para título da aplicação, nome do personagem, títulos de seção, rótulos, valores e notas.
- [x] Definir espaçamentos, alturas de controle, raios e pesos de borda por função; aproveitar tokens existentes.
- [x] Dar maior destaque aos valores consultados durante o jogo e reduzir ruído de instruções auxiliares.
- [x] Manter tipografia da identidade de cada layout quando pertinente; estabelecer consistência entre shell, Configurações e ficha.
- [x] Buscar alvos de toque confortáveis, aproximadamente 44 px, sem aumentar todos os blocos de informação.
- [x] Manter contraste de textos/rótulos de pelo menos 4,5:1 e foco visível nas doze combinações de cores.
- [x] Definir cores, tamanhos e margens próprios para papel, sem herdar fundos/acentos das paletas de tela.
- [x] Registrar o contrato: conteúdo do PDF vem do personagem atual e do layout/sistema, não do estado de navegação ou de um filtro de UI.

**Saída:** decisões visuais e de conteúdo suficientes para implementar. Sem impor uma nova identidade ao RPG ainda sem nome.

### Etapa 2 — Impressão/PDF

#### 2A. Conteúdo e preparação

- [x] Escolher uma solução pequena e revisável: apresentação de impressão dedicada, com CSS próprio e preparação de valores quando necessária.
- [x] Reutilizar formatos, rótulos e cálculos existentes; não duplicar regras autorais ou D&D em um gerador paralelo.
- [x] Se houver renderização auxiliar, usar uma cópia dos dados e evitar IDs duplicados, inscrições persistentes ou callbacks que alterem a ficha.
- [x] Não depender apenas de clonar o DOM visível nem usar os resultados da busca como representação completa da ficha.
- [x] Mostrar dados de todas as abas relevantes, listas completas e conteúdo de cartões recolhidos.
- [x] Apresentar seleções pelo rótulo escolhido; recursos como atual/máximo; booleanos como estado identificável; compostos como d12 + d6.
- [x] Exibir valores calculados determinísticos atuais sem executar fórmulas de rolagem.
- [x] Preservar notas e descrições integrais, quebras de linha, retrato existente e registros persistidos relevantes.
- [x] Representar campos vazios com clareza; não imprimir placeholders, opções iniciais de formulários ou valores inventados.
- [x] Excluir ações de criação/evolução, montagem de Pool, pagamento/uso de Técnicas, upload e filtros. Manter os dados e registros associados ao personagem.
- [x] Imprimir somente a ficha atual, mesmo quando a aplicação estiver em Configurações ou bibliotecas.
- [x] Imprimir uma única ficha na comparação D&D; registrar a política visual e garantir conteúdo equivalente nos três modos.

#### 2B. Layout e paginação

- [x] Usar A4 retrato e margens explícitas; começar pelas margens atuais de 12 mm e ajustar com evidência visual.
- [x] Usar fundo branco, texto escuro e diferenciação de títulos/valores que funcione sem impressão de fundos.
- [x] Reduzir o cabeçalho e retirar sombras, gradientes e caixas decorativas de tela.
- [x] Manter ornamentos decorativos omitidos; conservar dados vetoriais funcionais com texto quando essa for a preferência.
- [x] Transformar textos longos em blocos que possam crescer e continuar em outra página.
- [x] Manter títulos junto ao primeiro conteúdo; permitir dividir seções maiores que uma página.
- [x] Evitar quebra de linhas curtas de tabelas; repetir cabeçalhos quando a tabela continuar.
- [x] Tratar células/itens muito longos sem cortar conteúdo para cumprir uma regra de não quebra.
- [x] Evitar páginas em branco, grandes espaços causados por blocos indivisíveis e cortes por `overflow`.
- [x] Acrescentar identificação do personagem/sistema e numeração onde o navegador permitir; verificar o PDF real e documentar qualquer fallback.
- [x] Evitar que cabeçalhos/rodapés automáticos do navegador dupliquem informações ou exibam a URL local no exemplo entregue.
- [x] Comparar fichas vazias e preenchidas. Não impor um número máximo de páginas que obrigue a diminuir demais a fonte ou omitir dados.

#### 2C. Integração e validação

- [x] Atender ao botão de impressão e ao Ctrl/Cmd+P, incluindo impressão iniciada fora da ficha.
- [x] Garantir que preparar, cancelar ou repetir a impressão não altere personagem, preferências, aba ativa, filtros ou apresentação.
- [x] Verificar edição recente ainda não gravada pelo debounce: o PDF deve representar o estado atual em memória.
- [x] Manter exportação/importação JSON e salvamento funcionando como antes.
- [x] Testar impressão em claro/escuro, nas apresentações D&D e em um sistema importado.
- [x] Gerar PDF com e sem fundos; a leitura dos valores deve continuar correta.
- [x] Renderizar as páginas dos exemplos finais e inspecionar todas, sobretudo transições, tabelas e finais de textos longos.

**Aceite:** conteúdo completo e legível, uma ficha por exportação, ausência de controles operacionais e estado do aplicativo preservado. Uma prévia bonita sem inspeção do PDF paginado não encerra a etapa.

### Etapa 3 — Cabeçalho e espaço útil

- [x] Reunir ações secundárias no celular em uma abertura "Mais", mantendo todos os comandos existentes acessíveis.
- [x] Usar um disclosure/menu simples com nome acessível, indicação de abertura e fechamento por teclado; não aplicar papel ARIA de menu sem sua navegação correspondente.
- [x] Permitir fechar por Escape, clique fora e escolha de comando; devolver foco de maneira previsível.
- [x] Preservar IDs e listeners dos comandos; evitar duplicar botões, uploads ou diálogos ao mudar de largura.
- [x] Distinguir claramente exportar JSON de imprimir/salvar como PDF na apresentação dos comandos.
- [x] Compactar marca, contexto e indicador de salvamento; manter nome do sistema/personagem identificável.
- [x] Reduzir altura e padding do cabeçalho do personagem, preservando nomes longos e hierarquia.
- [x] Revisar offsets de elementos fixos/sticky, busca e foco para que nada fique escondido sob o cabeçalho.
- [x] Comparar a posição do primeiro valor antes/depois na mesma ficha de 360 × 900 px; obter ganho visível sem esconder controles essenciais.
- [x] Conferir desktop, orientação horizontal e retorno ao celular, sem ações duplicadas ou inacessíveis.

**Aceite:** mais informação útil na primeira tela e todos os comandos funcionando com mouse, toque e teclado.

### Etapa 4 — Configurações

- [x] Organizar Cores, Dados e Ornamentos em abas/painéis identificados.
- [x] Implementar relações entre aba/painel, estado selecionado, foco e navegação por teclado.
- [x] Manter a escolha de paleta e claro/escuro independente; preservar valores e outras chaves do armazenamento.
- [x] Manter Texto como padrão e Vetor com texto como alternativa independente dos ornamentos.
- [x] Tornar famílias ornamentais recolhíveis; indicar peças selecionadas sem obrigar o usuário a abrir todas.
- [x] Recolher uma família sem desativar suas peças nem deslocar foco para conteúdo oculto.
- [x] Manter prévia, ativação geral, combinação pronta e intensidade próximas dos controles; evitar uma prévia fixa cobrindo campos no celular.
- [x] Explicar a substituição de uma posição ocupada e preservar os avisos acessíveis.
- [x] Garantir que trocar de painel/família, tema, sistema ou recarregar não apague preferências.

**Aceite:** o usuário localiza cada escolha sem percorrer a página inteira e entende o resultado da composição.

### Etapa 5 — Ornamentos, bordas e acabamento

- [x] Integrar a composição ornamental ao cabeçalho da ficha com uma área reservada, sem arte por trás de nomes, valores ou controles.
- [x] Preservar esquerda/centro/direita, máximo de três peças, presets, intensidade e a independência da paleta.
- [x] Decidir uma única área ornamental na comparação D&D, evitando duplicação visual desnecessária.
- [x] Adaptar a composição ao celular sem ocultar silenciosamente peças escolhidas; manter a prévia coerente com a ficha.
- [x] Eliminar o espaço reservado quando a decoração estiver desligada ou sem peças.
- [x] Manter arte decorativa fora do foco, ignorada pelo leitor de tela e sem interceptar cliques.
- [x] Reduzir contornos redundantes em cartões aninhados; usar espaçamento e superfícies para agrupar informações.
- [x] Preservar bordas/foco que identificam campos editáveis e seleção ativa; não reduzir contraste para produzir uma aparência mais suave.
- [x] Padronizar tamanho aparente e peso dos vetores, sem deformar a geometria das artes do livro.
- [x] Conferir d4, d6, d8, d10, d12, d20, compostos e fallback sem desenho. Manter o texto dN e os rótulos dos símbolos da Pool.
- [x] Rever títulos, notas, alinhamentos, vazios, mensagens e estados de interação dentro dos padrões da etapa 1.
- [x] Conferir novamente o PDF depois das mudanças de tela, sobretudo os ícones funcionais e a exclusão de ornamentos.

**Aceite:** composição integrada e valores fáceis de ler, com as preferências anteriores intactas e sem comprometer a referência D&D.

### Etapa 6 — Verificação final e documentação

- [x] Executar testes funcionais pertinentes por etapa e a regressão completa ao final.
- [x] Conferir a matriz de tela e a matriz de impressão descritas abaixo.
- [x] Inspecionar visualmente capturas e páginas dos PDFs; conferir dados esperados, não apenas cores e quantidade de páginas.
- [x] Verificar ausência de erros no console, overflow da página e foco preso/escondido.
- [x] Conferir sincronização D&D, cálculos, rolagens, busca, personagens, importação/exportação e persistência.
- [x] Atualizar testes que dependiam da faixa ornamental separada, da página única de Configurações ou da antiga estrutura de impressão. Substituir essas verificações pelos novos contratos, mantendo cobertura funcional.
- [x] Atualizar `README.md`, `docs/busca-e-temas.md`, `docs/vetores-interface.md` e criar uma referência curta para impressão/PDF.
- [x] Registrar comportamento de navegador, parâmetros usados na geração e eventuais limitações verificadas.
- [x] Entregar exemplos fictícios, capturas e resultados atuais. Resultados históricos não substituem a execução final.

**Aceite:** todos os critérios obrigatórios atendidos e eventuais limitações explicitadas, sem declarar uma melhoria de impressão apenas com screenshots de tela.

## 4. Matriz de qualidade

As verificações podem ser distribuídas entre testes automatizados e revisão visual. Não é necessário repetir toda a matriz a cada ajuste de CSS.

| Área | Cobertura mínima | O que verificar |
| --- | --- | --- |
| Cores | Seis paletas × claro/escuro | Contraste, foco, seleção e leitura dos vetores |
| Larguras | 360, 768 e 1280 px; zoom de 200% em um caso representativo | Reflow, ausência de overflow global e controles alcançáveis |
| Fichas | D&D estática, modular, comparação e autoral | Dados sincronizados, leitura e áreas ornamentais |
| Configurações | Abas, famílias, presets, intensidade e dados | Teclado, foco, prévia, independência e persistência |
| Conteúdo | Nomes longos, texto extenso, listas, retrato e compostos | Ausência de cortes, sobreposição e perda de informação |
| PDF | D&D e autoral vazios e preenchidos; sistema importado | Todas as páginas legíveis e dados presentes |
| Navegação ao imprimir | Ficha, Configurações e bibliotecas | Somente o personagem atual, sem duplicação |
| Ciclo de impressão | Botão, Ctrl/Cmd+P, cancelamento e repetição | Estado anterior preservado, sem novas rolagens ou custos |
| Papel | Claro/escuro; fundos ligados/desligados | Mesma legibilidade e hierarquia de conteúdo |

Para economizar execução: automatizar contraste/reflow na matriz completa, revisar visualmente todas as paletas em uma ficha representativa e aprofundar a inspeção das telas onde a estrutura mudou. Para PDFs com conteúdo longo, verificar todas as páginas dos exemplos finais, inclusive o último trecho da descrição e o último item da coleção.

## 5. Arquivos e pontos de atenção

| Área | Arquivos atuais prováveis |
| --- | --- |
| Shell e comandos | `index.html`, `js/app.js`, `css/engine-shell.css` |
| Configurações | `js/appearance.js`, `js/artwork.js`, `css/appearance-search.css`, `css/artwork.css` |
| Cabeçalho e componentes | `js/engine/renderer.js`, `css/engine.css`, `css/components.css` |
| Identidade e cores | `css/variables.css`, `js/theme.js`, `js/data.js` |
| Vetores | `js/dice-display.js`, `assets/artwork/ornaments.js`, `assets/artwork/book-vectors.js` |
| Impressão | `css/print.css`, acionamento em `js/app.js`; módulo auxiliar se a preparação de leitura exigir |
| Formatos e regras compartilhados | `js/engine/fields.js`, `js/engine/advanced-fields.js`, módulos de assistência e `js/systems/dnd2024-fields.js` |
| Testes existentes | `tests/e2e/artwork.spec.js`, `search-themes.spec.js`, `dnd-presentation.spec.js`, `dnd-parity.spec.js`, `shell.spec.js` e testes autorais |
| Operação de testes | `playwright.config.js`, `tests/static-server.mjs`, `tests/global-setup.mjs` |

Os caminhos são pontos de partida, não autorização para reescrever todos esses arquivos. Inspecionar o código pertinente antes de cada alteração. Neste levantamento, os documentos `docs/continuidade.md`, `docs/arquitetura.md`, `docs/componentes.md` e `docs/dnd-parity.md` citados pelo projeto não estavam presentes; usar os arquivos reais e a documentação disponível.

### Execução dos testes

Para conjuntos existentes, conforme a etapa:

```sh
npx playwright test tests/e2e/artwork.spec.js tests/e2e/search-themes.spec.js
npx playwright test tests/e2e/dnd-presentation.spec.js tests/e2e/dnd-parity.spec.js tests/e2e/shell.spec.js
```

A cobertura específica foi implementada em `tests/e2e/print-export.spec.js`, com contratos de interface em `tests/e2e/refinement.spec.js`.

Para a regressão final:

```sh
npm run test:e2e
```

Executar os comandos sequencialmente, encerrando um servidor manual na porta 4173 antes das suítes. Para inspeção auxiliar, usar outra porta e fechar servidor/navegador ao terminar. Dimensionar timeout de matrizes extensas de maneira explícita; não mascarar falhas de conteúdo, overflow ou sincronização aumentando o tempo indiscriminadamente.

## 6. Entrega e limites

Uma entrega de qualidade inclui implementação, documentação, testes relevantes, capturas e PDFs realmente inspecionados. Não termina em "CSS ajustado" ou "todos os elementos visíveis no modo print".

Este plano não inclui novo nome/logo, fontes externas, novas paletas, novas famílias ornamentais, uploads de SVG, arraste livre, personalização por personagem, editor visual, backend ou publicação. Também não propõe mudar regras autorais ou a licença. Ampliar esses itens depende de outro pedido do usuário.

Na preparação original foi criado somente o roteiro, sem implementação ou execução de suíte funcional. Após o pedido explícito de execução, as etapas 0–6 foram implementadas e verificadas; os resultados atuais e as limitações estão no relatório vinculado acima.
