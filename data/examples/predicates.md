# Condições compartilhadas em pacotes v3

Uma condição é uma regra pura com resultado **Sim/Não**. Em **Compor → Dados tipados e vínculos**, crie um cálculo, escolha **Função da regra tipada → Condição compartilhada** e monte a árvore pelas operações e fontes nomeadas. Cálculos booleanos existentes também podem ser usados. As condições não lançam dados, alteram valores nem pagam recursos.

Selecione um componente na árvore e configure **Quando mostrar** ou **Quando permitir edição**, escolhendo a regra e uma explicação opcional. Grupos e instâncias locais propagam suas condições aos filhos. O contexto por entrada exige a coleção correspondente no repeat; a validação verifica isso mesmo quando a coleção está vazia.

Na receita de uma ação, use **Permissão compartilhada desta ação**. O botão informa o motivo do bloqueio e continua acessível pelo teclado. O executor consulta os valores atuais novamente ao executar: uma avaliação anterior da apresentação não autoriza a ação.

| Vínculo | Quando falso | Quando a avaliação falha |
| --- | --- | --- |
| Quando mostrar (`visibleWhen`) | Oculta o componente durante o jogo, sem apagar seu dado. | Mostra diagnóstico e bloqueia os controles. |
| Quando permitir edição (`editableWhen`) | Bloqueia edição e explica o motivo. | Bloqueia edição e mostra diagnóstico. |
| Permissão da ação (`allowWhen`) | Recusa a execução sem alterar a ficha. | Recusa a execução com diagnóstico. |

Busca e impressão incluem somente componentes cuja condição de visibilidade é verdadeira. Em **Compor**, um componente oculto aparece atenuado para permitir sua seleção e autoria. Em **Experimentar**, a condição funciona como durante o jogo. Alterar a amostra não muda o pacote exportado.

## Escolha o sentido da condição

**Existe** verifica a presença da propriedade: `false`, zero, texto vazio e `null` continuam presentes. **Referência resolvida** exige uma referência válida ao destino declarado; `null` e ausência não bastam. Uma autorização afirmativa deve ler um booleano e tratar ausência/null explicitamente, por exemplo com **Se ausente** e **Se null** usando alternativa **Não**.

Para `(A E B) OU Existe(C)`, A e B precisam ser booleanos válidos; com C ausente, ambos precisam ser Sim. Com C presente, inclusive Não ou null, Existe(C) é Sim. Curto-circuito não converte valores incompatíveis: um ramo necessário com tipo errado gera diagnóstico.

Visibilidade e autorização podem compartilhar a mesma regra ou usar regras diferentes conforme a intenção. Ocultar um campo não proíbe que cálculos leiam seu dado. Condições de edição também não concedem permissão para executar uma ação.

## Contrato e limites

Os vínculos guardam `ruleId` e `message` opcional de até 2.000 caracteres no documento canônico. A espécie `predicate` exige resultado `boolean` e usa o mesmo registro e orçamento dos [cálculos tipados](rule-queries.md). Não há scripts de pacote, conversão automática de v1/v2 ou avaliador paralelo. Os requisitos legados das ações continuam sendo exigidos junto com a permissão compartilhada.

Este contrato cobre apresentação e ações de `system.sheetActions`. Ele não transforma automaticamente testes, progressão ou gatilhos em ações com autorização compartilhada. Novas famílias têm seus próprios contratos e validação; uma condição pura não executa consequências.
