# Autoria visual de pacotes

Em **Sistemas**, crie ou abra um pacote e escolha **Compor**. O editor usa o mesmo documento, rascunho, histórico, validação, recuperação e fluxo de aplicação dos [formulários](editor-forms.md) e do [editor JSON](editor-json.md). Esta página registra a autoria visual implementada dos mecanismos atuais da engine. A ambição de configurar qualquer sistema continua aberta.

**Compor** seleciona a definição original e organiza a ficha. Campos e ações da prévia ficam suspensos. **Experimentar** usa um personagem de ensaio isolado e permite jogar as regras configuradas. Suas alterações não entram no pacote nem na biblioteca. Em uma repetição, selecionar qualquer ocorrência aponta para a mesma definição.

## Incluir componentes e dados

Em **Adicionar à ficha**, a toolbox agrupa cards em **Textos**, **Elementos**, **Caixas**, **Coleções**, **Cálculos**, **Regras** e **D&D**. Arraste um card para a prévia: a indicação mostra antes/depois no destino compatível. Campos prontos entram ao soltar; a prévia de Compor atualiza automaticamente e stack/grid/flex organizam os elementos pelo layout existente. Caixas e seções começam com um campo de texto real, pois o contrato atual exige componentes não vazios. Não há card apenas informativo independente.

Para uma regra que precisa de fontes, opções ou custos, o arrasto escolhe a posição e abre a receita correspondente. Também é possível tocar/escolher o card e configurar nome e grupo de destino. Uma configuração pode criar suas dependências ou reutilizar um componente existente. **Revisar inclusão** lista os dados, regras e mudanças de versão; cancelar conserva o documento. A inclusão confirmada constitui uma operação do histórico.

**Dados e catálogos** cria valores por nome e tipo, permite editar valores e oferece criação de catálogos, referências e grupos repetidos. As fontes conhecidas são escolhidas em seletores. Valores ausentes, null, zero, false e vazios são distintos; abrir controles não grava padrões.

O inspector apresenta as propriedades do bloco selecionado e permite abrir suas regras compartilhadas. Uma **cópia independente** de regra mantém os dados referenciados e muda o vínculo do componente selecionado; outros consumidores continuam na definição original. Fórmulas oferecem operações e fontes; rolagens oferecem grupos, quantidades, faces e modificador; condições oferecem a comparação admitida por seu consumidor. Não é preciso digitar a expressão gerada.

Mover oferece destinos e posições nomeados, com revisão. Arrasto da árvore, toolbox e alça da prévia usa os mesmos comandos. Soltar no destino confirma o movimento ou a inclusão pronta, como uma operação reversível do histórico. Escape cancela o gesto. A alternativa por controles nomeados e as receitas com dependências continuam oferecendo revisão explícita.

O [inventário por propriedade, contexto e consumidor](editor-capabilities.json) é uma projeção gerada dos contratos, metadados e exemplos públicos. Não é outro formato de pacote nem comprova execução de todas as combinações possíveis.

## Famílias implementadas

| Família | Autoria guiada | Limite da engine atual |
| --- | --- | --- |
| Campos e coleções | Texto, número, booleano, opções, imagem, recurso, contador, dado, lista e tabela; sete tipos de campos de entrada pelo inspector | Componentes têm contratos próprios; um recurso usa current/max. Imagens externas permanecem preservadas sem carregamento automático. |
| Cálculos e condições | Operações do parser, funções atuais, fontes e variáveis; igualdade e requisito mínimo conforme contexto | `if` avalia os ramos antes da escolha. Não há função `sum` ou linguagem universal de regras. |
| Testes | Oito algoritmos atuais, fontes de campo, entrada ou cálculo, nota de decisões manuais e botão compatível | Testes não descontam recursos nem resolvem consequências narrativas automaticamente. |
| Rolagens por entrada | Teste e efeito separados, grupos de dados, fontes, escala, informação e consumo opcional de recurso compartilhado | Fontes e consumo seguem o [contrato existente](README.md). Não representam qualquer economia de ações ou nova mecânica. |
| Ações e recuperação | Oito operações de ação, requisitos; quatro operações de recuperação, filtros e cura por dados/manual | Ações executam ao acionar seu botão. Recuperação oferece prévia e confirmação. Custos e condições precisam ser declarados. |
| Efeitos | Contribuições numéricas, alvos existentes, unidade, duração, habilitação v2 explícita e revisão semântica | Somente efeitos numéricos e empilhamento único atuais; [cobertura dos efeitos](effects.md). Não migra personagens instalados. |
| Usos | Níveis, usos, máximos, apresentação gasto/disponível e preferência de consumo | Uso automático exige vincular a rolagem ao mesmo recurso. |
| Perícias e traços | Categorias, perícias, dado base, escala, traços e conjuntos de distribuição | A escala é compartilhada. Aplicar conjunto substitui somente os valores dos traços correspondentes. |
| Estados graduados | Grau por dado, cura/redução, estado vinculado no limite e valores declarados nas transições | Usa o mecanismo e mensagens atuais de Desgaste/Trauma; não é uma máquina universal de condições. |
| Carga | Coleção, peso, quantidade, marca de carregado, capacidade base e multiplicador | Informa peso, capacidade e excesso. Penalidades são decisões da mesa. |
| Criação e evolução | Qualidades, pontos, fontes, custos entre passos, modificadores e fórmula pós-ascensão | Registros de criação, evolução paga e narrativa separados. Edição direta não cobra pontos. Custos são informados, nunca deduzidos de um nome. |
| Repertório | Especializações, técnicas, referências estáveis, graus, mínimos e distribuição | Repertório é um mínimo. Esta família consome maxDie e learningSource das técnicas. |
| Pool | Fontes constantes, sistema, ficha, mapa e coleções, filtros, oposição e dificuldade por operações | Peso usa Ápice + Base. O resolvedor atual compara d20 à dificuldade e oferece limiares críticos. Resolução e oposição são compartilhadas com técnicas. |
| Uso de técnicas | Atributos, perícias, especializações, técnicas, energia, concentração, modos, termos e custos por dado | Campos internos desta família são fixos. Usar e rolar paga o custo declarado, inclusive em falha; resolver usa a dificuldade configurada em Pool. |
| D&D | Seleção de atributos, perícias e sete derivados já registrados | Exige os dados próprios de D&D. Comece por uma cópia do pacote existente em Sistemas; não amplia a automação do livro. |

## Preservação e alcance

Texto pendente dos construtores e receitas fica na interface recuperável. Aplicar um campo é uma ação explícita; descarte também. Exportação e aplicação usam o fluxo existente, com validação e preflight. Dados de ensaio e interface ficam fora do pacote.

A cobertura é dos mecanismos atualmente implementados. Mecânicas adicionais podem exigir extensão da engine. A ambição de permitir que qualquer pessoa configure qualquer sistema continua aberta. Testes automatizados não substituem avaliação com iniciantes, aparelhos físicos ou tecnologias assistivas; resultados dessas avaliações não foram obtidos nesta entrega.
