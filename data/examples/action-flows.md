# Ações tipadas e resoluções

Em **Criar pacote → Compor → Ações tipadas e resoluções**, configure uma ação por etapas. O pacote começa vazio; adicionar uma ação não instala regras de um RPG.

1. Informe o nome e escolha o perfil de compromisso.
2. Acrescente entradas temporárias para escolhas, dificuldade ou oposição da mesa. Elas não criam dados no personagem. Tipos estruturados podem reutilizar uma definição tipada existente, com identidades locais próprias.
3. Produza valores e resoluções na ordem de execução. As expressões usam o mesmo construtor dos [cálculos tipados](rule-queries.md), com fontes adicionais de entrada e resultado anterior. Um resultado de dados oferece total, sucesso quando configurado, indicação de lançamento e classificação textual.
4. Declare os custos e as consequências. Revise e confirme a definição, depois use **Experimentar** com a amostra isolada.

**Prévia integral:** Resolver prepara o resultado sem alterar a ficha. Cancelar conserva os recursos; Confirmar resultado aplica custos e consequências juntos. **Ativação:** Comprometer ativação guarda um marco e paga os custos de ativação antes de lançar ou revelar dados. Fechar conserva esse compromisso; reabrir retoma a mesma execução. A falha de um teste mantém o pagamento de ativação declarado.

Cada custo identifica seu recurso, quantidade e política: subtrair do restante ou acrescentar ao usado até um máximo separado. Pode ocorrer sempre, somente no sucesso ou somente na falha; a ativação aceita apenas custos incondicionais. Todos os custos potenciais precisam caber antes de resolver. Uma quantidade dependente de resultado precisa declarar uma reserva máxima calculável antes dos dados. O preço final não pode excedê-la. Custos do mesmo recurso usam a mesma política e máximo. Zero é um custo explícito válido; ausência e null não viram zero.

As consequências podem definir, somar ou remover um dado opcional, ou inserir, atualizar e excluir entradas por identidade. Uma condição pode limitar cada consequência. Campos de coleção usam suas identidades e preservam os demais valores; a nova entrada recebe um ID uma única vez no plano. Fontes e destinos são conferidos novamente na confirmação, assim como a [permissão compartilhada](predicates.md). Mudanças durante a preparação bloqueiam o plano inteiro.

Os grupos numéricos permitem fontes de faces ou traços compostos, quantidade, modificador, manter/descartar maiores ou menores, soma de faces ou tamanhos e contagem por condição de face. Empates conservam a ordem original. Rerrolagem declara condição, teto, substituição/soma e escolha do jogador ou execução automática. A escolha opcional acontece sobre os dados apresentados; relançar não significa refazer o histórico. Explosão tem condição e teto explícitos; excedê-lo recusa o resultado inteiro. Faixas inclusivas nomeadas não podem se sobrepor.

O percentil compartilhado usa uma unidade e uma ou mais dezenas, com saldo de −2 a +2. A combinação 00 vale 100; bônus escolhe o menor candidato e penalidade o maior. Não acrescenta regras ocultas de críticos, sanidade ou evolução. Um lançamento condicional exige resultado explícito para o outro ramo, permitindo resolver um extremo declarado sem consultar o RNG.

Novas ações habilitam **schemaVersion 3 do template** mediante a confirmação de autoria. Personagens v1/v2 já instalados continuam nessa versão ao abrir; o painel oferece habilitação explícita de registros v3 e preserva uma cópia do original em recuperação. Não há conversão automática. A execução dos componentes e ações anteriores permanece disponível.

Os registros guardam ID da execução, revisão e assinatura de sistema/ação, entradas, leituras com presença, reservas, pagamentos, identidades geradas e transcript das faces. Retomar reutiliza as faces guardadas. Os marcos de ativação são gravados pelo coordenador e journal da biblioteca; resultados de ativação são guardados antes de sua apresentação. Se uma escrita falhar, o plano fica disponível para retry na página, sem alterar a ficha nem consultar novamente as faces já obtidas. Esse plano em memória não sobrevive a fechar a página; a retomada durável usa o último marco efetivamente salvo.

**Registros de ações** permite consultar, exportar o personagem completo e arquivar somente execuções concluídas. Arquivar conserva uma cópia completa em recuperação e é reversível pelo histórico desta sessão. Não há expurgo automático: até 50 registros, 64 KiB por execução e 512 KiB no conjunto. Pendentes não podem ser arquivados. Alterar o sistema com execução pendente é bloqueado no preflight para preservar sua retomada; alterações apenas de layout continuam possíveis.

Desfazer/refazer da ficha reaplica patches e registros, sem executar regras ou lançar dados. Marcos adjacentes da mesma execução podem formar uma operação causal mesmo após demora; uma edição intermediária rompe esse agrupamento. **Desfazer última ação** reverte a conclusão compatível com os valores atuais, preservando uma ativação anterior já paga. Recarregar reinicia o histórico de sessão e conserva os registros salvos.

Limites: 128 etapas, 32 entradas e 32 custos por ação; 32 grupos por resolução; orçamento de 100 lançamentos compartilhado entre as resoluções, incluindo faces reaproveitadas, rerrolagens e explosões. As expressões compartilham um orçamento de 100 mil passos. Destinos em entradas usam operações de coleção por ID; não há escrita em outra ficha, scripts do pacote, eventos automáticos, cartas ou símbolos arbitrários neste contrato. Não representa qualquer livro sem novas capacidades distribuídas pela aplicação.

Texto inválido e edições pendentes ficam no rascunho da sessão e bloqueiam exportação/aplicação até serem aplicados ou descartados. Exportar o pacote leva definições e iniciais; resultados do ensaio não entram nele. Exportar o personagem leva seus registros. Use também o [backup da biblioteca](catalog.md) e consulte os [limites do histórico](history.md).
