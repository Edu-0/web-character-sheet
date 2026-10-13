# Consultas e cálculos visuais — AV-03

**Custo cumulativo pelos passos** usa escala declarada e catálogo de transições, com patamar inicial/final explícitos; preço ausente/duplicado bloqueia e zero permanece válido. Veja [criação e evolução](progression-choices.md).

Em **Compor → Dados tipados e vínculos → Cálculos tipados**, escolha o resultado **Número**, **Texto** ou **Sim/Não**. Monte a árvore selecionando operações, fontes e partes pelos nomes. Uma regra pode ser compartilhada por vários componentes **Cálculo**. Ela usa os dados atuais do personagem; seu resultado não é salvo como um segundo valor.

Para calcular carga equipada, crie uma coleção com Peso, Quantidade e Equipado. Monte **Somar valores da lista → Transformar cada entrada → Filtrar entradas**. O filtro lê Equipado; a transformação multiplica Peso por Quantidade. Em Experimentar, incluir, alterar ou reordenar entradas atualiza o resultado pelos IDs. Uma coleção presente e vazia soma zero. Uma coleção ausente exige uma alternativa explícita, por exemplo **Usar se ausente → Coleção vazia explícita**.

Para preço de uma rota, use **Consultar catálogo → Buscar entrada por identidade → Ler campo de registro**. A identidade vem de uma referência do personagem. Preço zero permanece zero. Referência ausente, inválida ou ambígua produz diagnóstico; escolha **Se… então… senão** com **Existe a propriedade** ou **Referência resolvida** quando desejar tratar essa situação. O aplicativo não inventa uma rota padrão.

Para consultar uma tabela por uma condição, use **Filtrar entradas → Única entrada da coleção → Ler campo de registro**. Por exemplo, filtre a Face de um catálogo de preços pela face escolhida na ficha. A consulta exige exatamente uma entrada: nenhuma ou mais de uma produz diagnóstico, sem escolher a primeira ou fornecer um preço padrão. Um preço declarado como zero continua válido. A entrada conserva seu contexto, inclusive para consultar coleções internas.

**Primeira entrada da coleção** escolhe pela ordem declarada; uma coleção vazia produz ausência. Use quando a ordem fizer parte da regra, como desempatar fontes já filtradas. **Identidade desta entrada** permite comparar ou excluir a entrada selecionada por seu ID estável, preservando nomes e ordem das demais. Registros comuns não possuem identidade de entrada. Para preços que exigem uma correspondência única, conserve **Única entrada da coleção**. Entradas selecionadas também podem ser reutilizadas como registros locais das ações, com seu contexto derivado; isso não cria outro dado salvo.

**Se… então… senão**, **E**, **OU**, **Usar se ausente** e **Usar se nulo** avaliam somente a parte necessária. Todos os ramos são validados antes de admitir a regra: uma operação desconhecida ou vínculo inexistente continua inválido mesmo num ramo que não será executado. Ausência, null, false, zero e texto vazio são distintos. Não há conversões implícitas entre tipos; **Converter valor para texto** é explícito.

| Família | Operações disponíveis |
| --- | --- |
| Fontes e reuso | Valor literal, Ler dado, Opção de escolha, Usar resultado de cálculo, Reutilizar parte existente |
| Presença e decisão | Usar se ausente, Usar se nulo, Se… então… senão, Existe a propriedade, É null explícito, É vazio, Referência resolvida |
| Números e comparações | Somar, Subtrair, Multiplicar, Dividir, Arredondar para baixo, Valor absoluto, Igual, Menor/Maior que, Menor/Maior ou igual |
| Lógica e texto | E, OU, Não, Converter valor para texto, Juntar textos |
| Consultas | Consultar catálogo, Coleção vazia explícita, Filtrar entradas, Transformar cada entrada, Valor desta entrada, Somar/Contar/Menor/Maior valor da lista, Alguma/Todas as entradas atendem, Primeira entrada da coleção, Única entrada da coleção, Identidade desta entrada, Buscar entrada por identidade, Ler campo de registro |

Lista vazia tem soma/contagem zero, **Alguma** false e **Todas** true. Menor/Maior de lista vazia produz ausência; use uma alternativa quando necessário. Dados inválidos não são descartados pelo somatório. Divisão por zero e resultados não finitos produzem erro.

Uma regra global pode consultar coleções. Para mostrar um cálculo por entrada, escolha seu **Contexto de entrada** e coloque o componente dentro do repeat daquela coleção. A cadeia de IDs identifica cada resultado e seu ajuste, mesmo após reordenar. Ler um campo de entrada fora do contexto é recusado.

**Usar resultado de cálculo** permite escolher **automático** ou **efetivo**. O efetivo numérico inclui os ajustes compatíveis já existentes; o automático conserva a regra declarada. Texto e Sim/Não não oferecem ajuste numérico. Dependências e partes são ligadas por identidade; ciclos são recusados. Fontes tipadas também podem alimentar as rolagens compatíveis, respeitando o tipo e o contexto aceitos pelo consumidor.

Em Experimentar, abra **Leituras de…** para ver as operações realmente avaliadas e seus intermediários. **Conferir leituras e resultados** compara a amostra atual com uma criação pelo template e pelos iniciais explícitos, incluindo entradas e cálculos. Exportar o pacote conserva as regras, sem copiar a amostra. A aplicação e a persistência continuam nos fluxos comuns da biblioteca.

O contrato v3 admite até 100 regras, 2048 nós por regra, profundidade de árvore 32 e de dependências 128. Cada avaliação/revisão tem limites de 10000 passos e visitas de entradas; o orçamento agregado também limita consultas aninhadas. Textos têm limite de 100000 caracteres. Limites gerais de documento continuam valendo e podem ser atingidos antes. Cache e índices pertencem à revisão explícita e são descartados quando os dados mudam. Estas operações são puras: não sorteiam dados nem escrevem consequências. Ações, permissões e eventos possuem etapas próprias.

Consulte também [primeiro vínculo](typed-data.md), [dados estruturados](structured-data.md) e [referência de componentes](components-reference.md).
