# Refinamento de design e PDF — execução de 1º–2 de outubro de 2026

Este relatório preserva o resultado da primeira iteração. Após a revisão do usuário, o PDF recebeu a identidade visual da ficha; consulte a [segunda revisão](design-pdf.md). Os seis PDFs desta primeira entrega estão preservados em `output/pdf/plain-reference`; os links desta tabela apontam para essa referência histórica.

## Escopo e estado inicial

Executadas as etapas 0–6 do plano, após autorização do usuário. No início, `git status` indicava somente `docs/plano-refinamento-design-pdf.md` não versionado. Nenhuma alteração rastreada do usuário foi sobrescrita. Não houve commit, deploy, mudança de licença ou carregamento de referências privadas.

`docs/continuidade.md`, `docs/arquitetura.md`, `docs/componentes.md` e `docs/dnd-parity.md` estavam ausentes. Foram usados README, AGENTS, os documentos disponíveis de sistema/busca/artes, os layouts e os módulos reais. Não foi reconstruída documentação histórica.

## Decisões implementadas

1. **Padrões:** nome 22–28 px, títulos de seção 18 px, rótulos 13 px, notas 12 px. Mantidas as fontes próprias dos layouts. Campos editáveis conservam contorno e foco; cartões internos têm menos bordas. Abas, disclosures e comandos compactos têm alvos de aproximadamente 44 px. As cores existentes permanecem independentes da densidade e da arte.
2. **Papel:** documento próprio A4 de leitura, construído com sistema/layout/personagem. Cálculos existentes reutilizados; nenhuma rolagem ou decisão narrativa nova. Política única para D&D, independente da apresentação. Detalhes no [contrato de impressão](impressao-pdf.md).
3. **Cabeçalho:** ações secundárias em Mais até 900 px, mantendo IDs/listeners e sem duplicar controles. Escape, clique externo, comando e saída de foco fecham a abertura. O nome completo pode quebrar linhas no cabeçalho da ficha. Altura real do shell alimenta os offsets.
4. **Configurações:** Cores, Dados e Ornamentos são abas relacionadas aos painéis, com setas/Home/End. Famílias usam disclosures nativos e mostram as peças selecionadas no resumo. Recolher não desmarca nada. A prévia compartilha as posições reservadas do cabeçalho.
5. **Arte:** uma composição no cabeçalho compartilhado, inclusive em comparação. Laterais flanqueiam o texto, centro fica em espaço reservado acima. As três peças continuam presentes no celular. Desligar ou esvaziar elimina o espaço ornamental. Os nove desenhos e a geometria dos vetores foram preservados.
6. **Revisão:** testes funcionais, capturas em 360/768/1280 px e PDFs paginados reais. Artefatos usam dados fictícios e perfis novos.

## Diagnóstico reproduzido

As amostras iniciais foram geradas em Edge 154.0.4258.48, A4, fundos ligados, cabeçalho/rodapé automático desligado. PNGs renderizados confirmaram fundos escuros com valores pouco legíveis, controles operacionais, descrições ausentes/truncadas, corte do final de coleções e páginas vazias. Isso é evidência desta execução, não apenas a revisão histórica do plano.

Para reproduzir os casos iniciais: importar as amostras JSON de `output/design/before`, manter cartões de descrição recolhidos e imprimir as fichas. As amostras preenchidas têm 65 parágrafos e 42 itens. O marcador final da descrição e o marcador do último item não apareciam na extração dos PDFs antigos. Os arquivos antigos foram preservados para comparação, não regenerados com o código novo.

## Medições de espaço útil

Posição vertical do primeiro campo de dados, em 360 × 900 px, decoração desligada, mesma identidade de exemplo:

| Ficha | Antes | Depois | Ganho |
| --- | ---: | ---: | ---: |
| D&D modular vazia | 793 px | 486 px | 307 px |
| D&D modular preenchida | 819 px | 539 px | 280 px |
| Autoral vazia | 755 px | 416 px | 339 px |
| Autoral preenchida | 839 px | 469 px | 370 px |

Os JSONs `output/design/before/report.json` e `output/design/after/report.json` guardam as medições, larguras, versão de navegador e erros. Nome longo com ornamentos ocupa mais altura porque o texto permanece completo e as peças não o encobrem.

## Exemplos para revisão

| PDF fictício | Antes | Atual |
| --- | ---: | ---: |
| [D&D vazio](../output/pdf/plain-reference/dnd2024-empty.pdf) | 8 páginas | 3 páginas |
| [D&D preenchido](../output/pdf/plain-reference/dnd2024-filled.pdf) | 10 páginas, conteúdo perdido | 9 páginas |
| [Autoral vazio](../output/pdf/plain-reference/sistema-rpg-empty.pdf) | 12 páginas | 4 páginas |
| [Autoral preenchido](../output/pdf/plain-reference/sistema-rpg-filled.pdf) | 18 páginas, conteúdo perdido | 13 páginas |
| [Importado, escuro com fundos](../output/pdf/plain-reference/imported-dark.pdf) | sem referência inicial | 8 páginas |
| [Importado, claro sem fundos](../output/pdf/plain-reference/imported-light.pdf) | sem referência inicial | 8 páginas |

Não há meta de páginas. O autoral atual inclui todas as perícias implícitas e registros persistidos; a amostra final também exercita técnicas/concentração. Quantidade de páginas isoladamente não mede completude.

Capturas antes/depois, incluindo comparação e Configurações, estão em `output/design/before` e `output/design/after`. Exemplos: D&D no celular [antes](../output/design/before/dnd2024-filled-360.png) e [depois](../output/design/after/dnd2024-filled-360.png), [ornamentos no celular](../output/design/after/settings-ornaments-360.png) e [comparação no desktop](../output/design/after/compare-1280.png). Cada PDF final tem uma pasta homônima em `output/pdf` com todas as páginas, folhas de contato e texto extraído. Os relatórios de conteúdo ficam em `pdf-report.json` e `verification.json`.

## Verificações atuais e limites

**Regressão final: 96 testes aprovados em 3,5 minutos**, com `npm run test:e2e -- --workers=2`, após as últimas correções dos rótulos Exportar/Importar JSON e do destaque/alvo de toque da apresentação D&D selecionada. `git diff --check` também passou. Antes dessa confirmação, os testes dirigidos de interface tiveram 24 aprovações, os oito testes novos passaram e duas regressões completas passaram em 4,5 e 4,2 minutos. A correção de um rótulo nos dados fictícios foi validada separadamente pelos cinco testes de impressão (15,3 segundos).

A primeira tentativa completa teve 92 aprovações e quatro falhas: duas expectativas presas à estrutura antiga do cabeçalho/DOM de impressão, uma falta de recursos do navegador (`ERR_NO_BUFFER_SPACE`) e uma captura de página inteira que fechava o popover de ajuda ao redimensionar a viewport. As expectativas foram adaptadas aos novos contratos, mantendo retrato, conteúdo e sincronização; a captura de ajuda passou a usar a viewport. A regressão foi executada sequencialmente com dois workers, sem capturas concorrentes.

Foram renderizadas e revisadas visualmente todas as **45 páginas dos seis PDFs finais**, com ampliação das páginas de transição e registros complexos. A verificação automatizada dos arquivos reais confirmou A4, ausência de páginas vazias e texto fora das margens, todos os 65 parágrafos em ordem, os 42 itens, as 70 linhas do importado, marcadores finais e repetição dos cabeçalhos de tabela. O PDF importado em tema escuro com fundos e o claro sem fundos produziram pixels idênticos. As capturas de tela não registraram erros de JavaScript nem overflow global nos 12 casos de ficha medidos. As doze combinações de paleta/tema foram revisadas e os testes de contraste e foco passaram.

O reflow de zoom foi exercitado em viewport de 640 × 450, equivalente à área CSS de 1280 × 900 a 200%, além de paisagem e nomes longos. Não é uma medição do zoom da interface do sistema operacional. A integração Ctrl/Cmd+P usa `beforeprint` nativo, também utilizado pelo PDF real do Chromium; o diálogo nativo e seu cancelamento físico não são automatizados no modo headless. O teste de cancelamento cobre preparação/limpeza por eventos e preservação do estado. Não foram testados impressão física, Firefox ou Safari; caixas de margem e paginação podem variar nesses ambientes.
