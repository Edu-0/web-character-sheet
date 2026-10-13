# Ações tipadas e resoluções

Em **Criar pacote → Compor → Ações tipadas e resoluções**, configure uma ação por etapas. O pacote começa vazio; adicionar uma ação não instala regras de um RPG.

1. Informe o nome e escolha o perfil de compromisso.
2. Acrescente entradas temporárias para escolhas, dificuldade ou oposição da mesa. Elas não criam dados no personagem. Tipos estruturados podem reutilizar uma definição tipada existente, com identidades locais próprias.
3. Produza valores e resoluções na ordem de execução. As expressões usam o mesmo construtor dos [cálculos tipados](rule-queries.md), com fontes adicionais de entrada e resultado anterior. Um resultado de dados oferece total, sucesso quando configurado, indicação de lançamento, classificação textual e grupos tipados. Em **Campo do registro na operação tipada**, consulte os totais por fonte, dados originais/usados/mantidos, rerrolagens, explosões e candidatos/unidade/dezenas do percentil compartilhado. Use map/min/max/sum ou lookup nas coleções temporárias pelo mesmo construtor.
4. Declare os custos e as consequências. Revise e confirme a definição, depois use **Experimentar** com a amostra isolada.

**Prévia integral:** Resolver prepara o resultado sem alterar a ficha. Cancelar conserva os recursos; Confirmar resultado aplica custos e consequências juntos. **Ativação:** Comprometer ativação guarda um marco e paga os custos de ativação antes de lançar ou revelar dados. Fechar conserva esse compromisso; reabrir retoma a mesma execução. A falha de um teste mantém o pagamento de ativação declarado.

Acrescente **Escolher entrada após resolução** para decidir usando os resultados já apresentados. Configure a coleção fonte, use **Atualizar campos da escolha** e selecione o campo que identifica cada opção. A entrada escolhida vira um resultado local tipado para as etapas seguintes. Nenhum custo de resultado ou consequência é aplicado enquanto faltar uma escolha; selecionar reutiliza as faces guardadas. Na ativação, fechar e retomar conserva também as escolhas já guardadas. Uma condição exige uma alternativa explícita da mesma coleção para o ramo sem escolha. Há limites de 32 etapas de escolha e 100 opções por etapa; coleção vazia ou identidade inválida bloqueia a execução. A regra não escolhe uma opção automaticamente.

Cada custo identifica seu recurso, quantidade e política: subtrair do restante ou acrescentar ao usado até um máximo separado. Pode ocorrer sempre, somente no sucesso ou somente na falha; a ativação aceita apenas custos incondicionais. Todos os custos potenciais precisam caber antes de resolver. Uma quantidade dependente de resultado precisa declarar uma reserva máxima calculável antes dos dados. O preço final não pode excedê-la. Custos do mesmo recurso usam a mesma política e máximo. Zero é um custo explícito válido; ausência e null não viram zero.

As consequências podem definir, somar ou remover um dado opcional, ou inserir, atualizar e excluir entradas por identidade. Uma condição pode limitar cada consequência. Campos de coleção usam suas identidades e preservam os demais valores; a nova entrada recebe um ID uma única vez no plano. Fontes e destinos são conferidos novamente na confirmação, assim como a [permissão compartilhada](predicates.md). Mudanças durante a preparação bloqueiam o plano inteiro.

As consequências são preparadas em ordem: uma consequência posterior pode consultar as mudanças anteriores do mesmo plano. Quando a decisão deve usar a ficha anterior às consequências, guarde a consulta, a condição ou o grau em **Produzir valor temporário** antes delas. Isso permite, por exemplo, criar um estado vinculado no primeiro uso e elevá-lo somente no uso seguinte. Para atualizar várias entradas, use **Atualizar campos de cada entrada → Registro com campo substituído** e defina a coleção com a cópia produzida. Preparação continua isolada; só a confirmação aplica o conjunto.

Os grupos numéricos permitem fontes de faces ou traços compostos, quantidade, modificador, manter/descartar maiores ou menores, soma de faces ou tamanhos e contagem por condição de face. Empates conservam a ordem original. Rerrolagem declara condição, teto, substituição/soma e escolha do jogador ou execução automática. A escolha opcional acontece sobre os dados apresentados; relançar não significa refazer o histórico. Explosão tem condição e teto explícitos; excedê-lo recusa o resultado inteiro. Faixas inclusivas nomeadas não podem se sobrepor.

A fonte **Lista de faces por consulta** recebe uma lista numérica, com até 100 dados, pelas operações de consulta. Ela permite rolar os traços da coleção atual sem fixar a quantidade de entradas na ação. Uma lista vazia não rola; quantidade zero omite a fonte. Faces inválidas e listas extensas são recusadas antes de lançar esses dados. O orçamento compartilhado de lançamentos continua valendo entre resoluções. As faces continuam no mesmo transcript e resolvedor, com as mesmas políticas de seleção, rerrolagem e explosão.

O percentil compartilhado usa uma unidade e uma ou mais dezenas, com saldo de −2 a +2. A combinação 00 vale 100; bônus escolhe o menor candidato e penalidade o maior. Não acrescenta regras ocultas de críticos, sanidade ou evolução. Um lançamento condicional exige resultado explícito para o outro ramo, permitindo resolver um extremo declarado sem consultar o RNG.

Novas ações habilitam **schemaVersion 3 do template** mediante a confirmação de autoria. Personagens v1/v2 já instalados continuam nessa versão ao abrir; o painel oferece habilitação explícita de registros v3 e preserva uma cópia do original em recuperação. Não há conversão automática. A execução dos componentes e ações anteriores permanece disponível.

Os registros guardam ID da execução, revisão e assinatura de sistema/ação, entradas, leituras com presença, reservas, pagamentos, identidades geradas e transcript das faces. Retomar reutiliza as faces guardadas. Os marcos de ativação são gravados pelo coordenador e journal da biblioteca; resultados de ativação são guardados antes de sua apresentação. Se uma escrita falhar, o plano fica disponível para retry na página, sem alterar a ficha nem consultar novamente as faces já obtidas. Esse plano em memória não sobrevive a fechar a página; a retomada durável usa o último marco efetivamente salvo.

**Registros de ações** permite consultar, exportar o personagem completo e arquivar somente execuções concluídas. Arquivar conserva uma cópia completa em recuperação e é reversível pelo histórico desta sessão. Não há expurgo automático: até 50 registros, 64 KiB por execução e 512 KiB no conjunto. Pendentes não podem ser arquivados. Alterar o sistema com execução pendente é bloqueado no preflight para preservar sua retomada; alterações apenas de layout continuam possíveis.

Desfazer/refazer da ficha reaplica patches e registros, sem executar regras ou lançar dados. Marcos adjacentes da mesma execução podem formar uma operação causal mesmo após demora; uma edição intermediária rompe esse agrupamento. **Desfazer última ação** reverte a conclusão compatível com os valores atuais, preservando uma ativação anterior já paga. Recarregar reinicia o histórico de sessão e conserva os registros salvos.

Limites: 128 etapas, 32 entradas e 32 custos por ação; 32 grupos por resolução; orçamento de 100 lançamentos compartilhado entre as resoluções, incluindo faces reaproveitadas, rerrolagens e explosões. As expressões compartilham um orçamento de 100 mil passos. Destinos em entradas usam operações de coleção por ID; não há escrita em outra ficha, scripts do pacote, cartas ou símbolos arbitrários neste contrato. Não representa qualquer livro sem novas capacidades distribuídas pela aplicação.

Texto inválido e edições pendentes ficam no rascunho da sessão e bloqueiam exportação/aplicação até serem aplicados ou descartados. Exportar o pacote leva definições e iniciais; resultados do ensaio não entram nele. Exportar o personagem leva seus registros. Use também o [backup da biblioteca](catalog.md) e consulte os [limites do histórico](history.md).

[Gatilhos locais](rule-events.md) podem acrescentar uma cadeia declarada à confirmação do resultado, com orçamento compartilhado, custos e marcadores na mesma transação. Ativação e checkpoint mantêm sua política explícita.

## Grupos e faces como resultados temporários

Uma técnica pode consultar uma especialização por referência, usar seu traço junto de outras fontes e escolher a potência depois das faces, na mesma ação. Declare o preço por tabela, o momento do pagamento e os campos de concentração. A manutenção pode ter preço zero e exigir o grau já sustentado; aumentar o máximo permitido da técnica não aumenta esse grau automaticamente. Zero explícito e alternativa para preço ausente são escolhas diferentes. O editor não acrescenta essas regras ao criar um pacote.

Uma fonte composta d8+d6 com faces4+3 produz total7 para essa fonte. Com outra fonte de resultado2, máximo/mínimo/soma dos **totais das fontes** produzem7/2/9; somar faces indiscriminadamente não define Ápice ou Base. O autor escolhe quais consultas representam seu sistema. Nenhuma medida chamada Pool é acrescentada automaticamente.

No percentil com unidade0 e dezenas0/5, a coleção de candidatos contém100/50. Ela pode alimentar mínimo, máximo ou outra classificação declarada. As faces originais, usadas e descartadas continuam distinguíveis; cada dado tem identidade relativa dentro do grupo. Essas coleções descrevem o mesmo transcript, sem rolagem adicional ou binding no personagem.

O ramo sem lançamento tem grupos vazios. Quantidade explicitamente zero não consulta o valor da fonte e omite seu grupo se não houver outro dado nele; assim não introduz um zero falso em mínimo/máximo das fontes participantes. Fontes e operações continuam validadas estaticamente. Grupos/dados seguem os limites de32/100; uma identidade sintética ambígua é diagnosticada antes da execução. Os campos anteriores de total/sucesso/lançamento/faixa mantêm suas identidades usuais.

## Aquisição com proveniência na ação

Em **Tipo da nova etapa**, escolha **Adquirir opção com proveniência**. Selecione uma opção já configurada em [Criação, evolução e concessões](progression-choices.md), declare a origem e configure as condições de escolha das alternativas. Cada condição usa o mesmo construtor; entradas booleanas podem representar escolhas da pessoa que executa a ação. A cardinalidade continua sendo a da progressão.

Essa etapa reutiliza o plano de aquisição, seu orçamento, requisitos e registro de origem. Não duplique seu preço nos custos diretos da ação. Custos diretos e aquisições compartilham a reserva de saldo antes do RNG, com limite combinado de32 custos potenciais. O preço final da aquisição não pode superar a reserva. Uma concessão narrativa não exige nem cria um saldo opcional ausente.

Uma ação determinística com aquisição é ensaiada em um candidato descartável antes de cobrar ativação; o ensaio usa os mesmos marcos e executor, sem gravar registro ou lançar dados. Requisitos e escolhas são conferidos novamente na preparação final. Em ações com dados, reserve os custos antes da rolagem; consequências condicionais só adquirem quando sua condição permitir. Aquisições sequenciais podem usar o requisito registrado pela anterior na mesma confirmação. Erro em qualquer etapa recusa a mudança inteira.

As identidades da aquisição e dos benefícios permanecem nas tentativas de gravação e na retomada de uma ativação. Confirmar reúne preço, concessões, ledger, registros de ação e consumo de proposta na transação existente. Cancelar uma prévia não compra; desfazer/refazer não rola ou cobra novamente. Uma proposta determinística sem entradas mostra seu bloqueio no painel de eventos enquanto a opção estiver indisponível; propostas que exigem escolhas continuam sendo revisadas no painel da ação.


Valores numéricos de consequências podem ter destino inteiro, inclusive campos de entradas. A execução valida o valor efetivo no candidato comum: frações, inteiros inseguros e valores fora das restrições do dado são recusados sem aplicar recursos ou consequências. Não há arredondamento nem coerção automática. O mesmo contrato já usado nas concessões de progressão vale para definir, inserir e atualizar pela ação.


Os menus de fontes, destinos e recursos mostram o caminho de nomes dos dados. Registros como “Espaços › Nível 1 › Usados” e “Espaços › Nível 2 › Usados” permanecem distintos por identidade; os máximos dos custos oferecem fontes globais executáveis nesse perfil. Custos de recurso usado podem ter quantidade calculada zero em níveis não escolhidos, com preferência de consumo e regra de exceção declaradas visualmente. Nenhum vínculo depende do nome de um RPG.
