# Vínculos e grafo de regras

Em **Compor**, abra **Fontes, vínculos e grafo de regras**. Busque pelo nome do cálculo, ação, componente ou dado. Abra um vínculo, escolha sua fonte e use **Revisar vínculo**. A confirmação valida a alteração antes de atualizar o pacote. Cancelar mantém o documento e a escolha pendente; **Desfazer JSON** e **Refazer JSON** usam o histórico comum do editor.

## Fontes e contexto

A vista reúne dados e campos tipados, catálogos, cálculos, entradas e resultados temporários de ações, efeitos, opções de progressão, compostos locais e referências legadas conhecidas. Identidades, tipos, contexto e dependências vêm do pacote atual. Entradas e resultados temporários pertencem à ação correspondente; parâmetros pertencem ao composto. Um vínculo inválido, cíclico ou incompatível é recusado antes da confirmação, com diagnóstico e sem alterar a regra.

Ao mudar a fonte de uma leitura, escolha **Base armazenada** ou **Efetivo com efeitos** para dados; cálculos oferecem **Automático** ou **Efetivo com ajustes**. Consulte a [ordem dos efeitos e ajustes](typed-effects.md). Os rótulos não substituem identidades: renomear um dado não cria outra fonte. Alterações de semântica incrementam a revisão correspondente. Mudar um binding de armazenamento de uma instalação pode exigir migração; esta vista não migra personagens.

## Grafo opcional

Escolha **Grafo e menus**. As linhas mostram as referências conhecidas entre fontes e definições. Arraste a porta de saída para a porta de destino; quando houver vários vínculos possíveis, escolha o vínculo específico. O cabo e o menu passam pelo mesmo plano, validação e confirmação.

Pelo teclado, use os menus completos ou selecione o vínculo com **Escolher fonte no grafo** e pressione Enter/Espaço na fonte. As portas de destino também permitem selecionar o vínculo. Arraste o corpo de um nó ou use as setas para organizá-lo. Essa posição fica no rascunho do editor, sem mudar cálculos, valores, ordem de execução ou o pacote exportado.

A lista tem páginas de 50 vínculos; o desenho mostra até 200 nós. Busca e menus continuam alcançando os vínculos fora do desenho. O grafo não é necessário para configurar ou executar as regras. Extensões opacas não são interpretadas como conexões.

## Edições ainda não confirmadas

Escolhas de fonte/modo, nomes de cálculos, números inválidos, entradas de catálogo e configurações de receitas ficam no rascunho existente. **Salvar rascunho** conserva o texto bruto e a escolha sem alterar o documento canônico. Depois de reabrir, use **Recuperar rascunho**. Cada receita de inclusão mantém sua edição, inclusive quando você escolhe outro tipo de componente.

**Exportar pacote** e **Aplicar pacote** exigem resolver ou descartar essas pendências. Em **Texto pendente dos formulários**, use **Descartar pendência** para limpar apenas a edição correspondente. Trocar de receita não descarta automaticamente seus valores. Exportar explicitamente a última versão válida continua sendo uma ação separada. A amostra de Experimentar e as posições do grafo ficam fora do pacote.

Veja também [autoria visual](editor-visual.md), [consultas e cálculos](rule-queries.md), [ações tipadas](action-flows.md) e [criação/evolução](progression-choices.md). Os limites deste editor não significam suporte universal a qualquer mecânica nem comprovação de acesso por tecnologias assistivas físicas.
