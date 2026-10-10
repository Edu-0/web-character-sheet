# Dados tipados e primeiro vínculo — AV-01

**Criar pacote** inicia um pacote v3 vazio: apenas identificação técnica e um destino de composição. Não há atributo, recurso, fórmula, teste ou cálculo pré-configurado. Em **Compor → Dados tipados e vínculos**, crie um dado sem precisar criar um componente. Ele pode ser opcional, admitir null e ter um valor inicial explícito.

Para mostrar o mesmo valor duas vezes, inclua dois componentes pela toolbox e escolha o mesmo **Dado do personagem**. Os componentes guardam `dataId`; a definição guarda o caminho de armazenamento (`binding`). Há um único valor no personagem. **Duplicar bloco** conserva esse vínculo. Mudar o rótulo do dado conserva identidade, armazenamento e fontes de cálculo. Ao selecionar um campo compatível, **Vincular valor de…** permite escolher outro dado, com revisão.

Em **Cálculos tipados**, crie uma regra independente de sua apresentação; pela toolbox, um componente **Cálculo** pode usar a regra existente ou construir uma nova. O construtor oferece operações e fontes por nome. A receita **a cada N, um ponto** gera Arredondar para baixo → Dividir → fonte e intervalo, e permite escolher explicitamente o que fazer com a fonte ausente. A árvore continua editável. Não é necessário digitar uma expressão, caminho ou código.

Exemplo: **Vínculos / 5**, arredondado para baixo, retorna 0 para 0/4, 1 para 5, 2 para 14, 3 para 15 e −1 para −1. Ausência não vira zero: escolha **Usar se ausente** com alternativa 0 se essa for a regra desejada. null permanece diferente de ausência e não é um número.

**Experimentar** altera apenas o personagem fictício. Mudar o valor em um dos dois campos atualiza o outro e o cálculo. **Conferir leituras e resultados** mostra os dados da amostra. Exportar pacote conserva a definição e suas operações, sem os valores experimentados. Exportação, reimportação e aplicação usam os fluxos comuns do editor e da biblioteca.

O [exemplo Primeiro vínculo](first-bindings.package.json) foi produzido pela jornada visual desde vazio; somente o nome e o ID do pacote foram ajustados para o exemplo público. Tem um dado opcional, dois componentes vinculados e um cálculo com alternativa 0 declarada. Seus IDs de dados/regras/nós são estáveis.

## Contrato v3 neste recorte

| Parte | Contrato |
| --- | --- |
| Pacote, sistema e layouts com a nova semântica | `schemaVersion: 3`. Abrir v1/v2 conserva a versão. **Habilitar dados tipados (v3)** é um comando explícito, confirmável e reversível; conserva campos, fórmulas e template antigos, sem convertê-los em regras novas. |
| Personagem e backup | Continuam nas versões 1/2. Os valores escalares usam os caminhos existentes do personagem; as identidades novas pertencem ao sistema. Backup com pacote v3 usa envelope 2. Clientes que só conhecem v1/v2 não leem o pacote v3. Não há downgrade automático. |
| `system.dataDefinitions` | Lista de até 500 definições: `id`, `label`, `type`, `binding`, `required`, `nullable`; `description`, `initial` e `extensions` opcionais. |
| Tipos disponíveis | `string`, `number` finito, `integer` seguro e `boolean`, sem conversões implícitas. Restrições adicionais, tipos de coleção/registro/traço/enum/referência ainda não integram este contrato. |
| Bindings | Caminho pontilhado seguro no personagem, independente do ID. Duas definições não podem ocupar caminhos iguais ou sobrepostos. `meta`, `schemaVersion`, `activeEffects` e `calculationOverrides` são reservados. Os pais devem ser objetos; arrays/null/escalares intermediários são incompatíveis. |
| Consumidores de dados | `text`/`textarea` aceitam texto; `number` aceita número/inteiro; `boolean` aceita Sim/Não. Usam `dataId`, sem `field` ou `default` concorrentes. Placeholder do texto e linhas da textarea continuam propriedades de cada apresentação. Outros componentes conservam seus contratos de `field`. |
| `system.rules` | Até 100 cálculos: `id`, `label`, `revision` positiva, `kind: "calculation"`, `resultType: "number"`, `expression` e `extensions` opcional. A saída é derivada, sem cópia no personagem. |
| Nós da expressão | `id` único na regra, `op`, `version: 1`, parâmetros da operação e `extensions` opcional. Até 128 nós e profundidade 16. Não há scripts, consultas, RNG, escrita ou referência a outras regras nesta fatia. |
| Consumidor de cálculo | `computed` com `ruleId`, sem `formula`, `variables` ou `mode` concorrentes. Ajustes usam `computed.<ruleId>`; ajuste/fixo seguem os controles existentes. |

| Operação | Parâmetros | Semântica |
| --- | --- | --- |
| `literal` | `value` numérico finito | Constante explícita. |
| `read` | `dataId` de número/inteiro | Lê valor e presença; não inicializa nem converte. |
| `ifAbsent` | `value`, `fallback` | Avalia fallback apenas se falta a fonte. 0 e null não acionam a alternativa. |
| `add`, `subtract`, `multiply`, `divide` | `left`, `right` | Operandos numéricos presentes; divisão por zero e resultado não finito dão erro. |
| `floor` | `value` | Piso matemático, inclusive para negativos. |

As operações são código distribuído com a aplicação, interpretadas pelo registro permitido. Operação/versão desconhecida, fonte incompatível, ID duplicado ou limite excedido bloqueia o contrato. Metadados seguros pertencem a `extensions`; opções desconhecidas de dados/regras/nós não recebem semântica silenciosa. Erros de leitura/cálculo aparecem junto ao resultado e na busca; não gravam resultados parciais.

Em v1/v2, raízes antigas chamadas `rules` ou `dataDefinitions` conservam sua função anterior de configuração/catálogo; não recebem execução tipada ao abrir. Os vínculos `dataId`/`ruleId` exigem v3. Habilitar v3 valida as raízes novas antes de confirmar: se uma configuração antiga ocupa esses nomes com outro formato, a habilitação fica bloqueada até resolver a colisão explicitamente, conservando o original.

## Presença, preservação e limites

Ausente, null, 0, false e texto vazio são distintos. Nos componentes vinculados, **Presença de…** permite retirar um dado opcional ou escolher null quando admitido. Limpar o input numérico retira o dado opcional; não produz zero. Texto vazio e Sim/Não falso são valores preenchidos. Um dado obrigatório não pode ser retirado. Inteiro fracionário ou valor incompatível é recusado sem alterar o valor compartilhado.

`initial` é aplicado ao criar personagem, ao criar a amostra fictícia de ensaio e ao confirmar **Limpar ficha**, que restaura os valores iniciais em uma edição reversível. Abrir a ficha, montar a prévia, acrescentar outro componente, importar ou aplicar um pacote não preenche valores ausentes de personagens existentes. O template pode trazer um valor explícito; ele tem precedência na criação/reset. Sem inicial e sem valor no template, a propriedade permanece ausente.

O texto do documento continua autoritativo na sessão existente. Construtores, seleção e raw numérico pendente ficam nos sidecars do rascunho. Edição pendente de uma regra existente bloqueia exportação/aplicação até aplicar ou descartar; cancelar a confirmação mantém a pendência. Uma receita nova ainda não incluída não entra no pacote exportado. Histórico, rascunhos, validação, sandbox e aplicação são compartilhados com os editores anteriores.

Com personagens vinculados, trocar/remover uma definição existente ou alterar binding/tipo/presença/nulabilidade exige migração e fica bloqueado em AV-01. Alterar seu rótulo, cálculo ou inicial não migra valores já salvos. Os originais do catálogo permanecem intactos.

v3 permite `components: []` para iniciar a composição vazia. A toolbox de caixas/seções continua incluindo seu campo de texto real. Esta entrega não inclui informação independente, compostos, repeat do personagem, consultas, dependências entre cálculos, ações/gatilhos/efeitos novos ou migração instalada. Fórmulas e componentes v1/v2 mantêm seus próprios defaults, coerções e avaliação de ramos; não herdam a semântica tipada nova.

O cabeçalho e a biblioteca continuam usando `identity.name`/`name` para nome de personagem. Criar um dado com outro nome não configura esse papel automaticamente. Autoria universal e compreensão/acessibilidade em aparelhos e tecnologias assistivas não estão comprovadas por esta fatia.
