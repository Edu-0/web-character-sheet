# Efeitos numéricos

Sistemas, layouts, personagens, pacotes e backups aceitam versões 1 e 2. Manifesto continua em 1. Documentos sem mecanismos novos conservam versão 1; versão 2 nunca é rebaixada automaticamente. `effectDefinitions`, `activeEffects` e `effectList` exigem versão 2. O envelope acompanha a maior versão de seu conteúdo.

Veja a definição executável do [Coringa SWADE](../systems/swade.system.json), baseada no [Test Drive oficial, p. 4](https://peg-swade.s3-us-west-2.amazonaws.com/SW_Test_Drive_2020.pdf). Carta, iniciativa, Benes e penalidades continuam manuais. Somente +2 nos testes de traço/dano recebe assistência; a mesa confirma ativação e fim da rodada.

Definições são uma lista de `{id, revision, label, stacking: "unique", applicability, duration, operations}`. Operação é `{type: "add", target: {kind, key, unit?}, value}`. `calculation` aponta para uma chave derivada elegível em algum layout; `checkModifier` aponta para uma chave de checks, com unidade compatível. Nunca aponta para um caminho de escrita em dados-base. `group` opcional impede duas definições ativas do mesmo grupo; não desativa automaticamente.

Instâncias guardam `{id, definitionId, definitionRevision, labelSnapshot, status, duration}` em activeEffects; status é active/inactive/expired. Duração é `{type: "manual"}` ou `{type: "untilEvent", event: "endRound"|"endScene"}`. Desativar não congela o prazo; confirmar evento expira também inativos vinculados que constavam da revisão. Remover exige encerramento. Reativar cria nova instância; não descarta a anterior.

applicability always aplica em todo uso elegível; confirmEachRoll exige seleção transitória por teste e não se aplica a cálculo derivado. Grupos/unidades não inventam regras ou pagamentos de outros jogos. Limites: 100 definições, 100 instâncias, 20 operações por definição; valores finitos entre −1000 e 1000, inteiros em testes.

Cálculo: automático + efeitos + ajuste manual. Valor fixo prevalece sobre ambos. Dependências usam o mesmo resolvedor; nenhum campo-base é escrito. Modificador de teste manual é adicional; não inclua o efeito uma segunda vez. Custos não recebem efeitos, recuperação pode ler cálculos efetivos e invalida prévias alteradas. Desfazer/refazer edita instâncias sem rerrolar ou cobrar novamente.

O effectList é obrigatório em cada layout de um sistema com efeitos. Mostra contribuições e supressão por valor fixo mesmo com ajustes ocultos; busca/impressão usam a mesma descrição. Revisões com semântica alterada devem crescer; substituição é barrada enquanto houver instância ativa incompatível. Extras são preservados e inertes. Ativação em personagem v1 confirma migração, copia o original na mesma transação e reinicia o histórico antes da ação.

Instâncias inativas ou expiradas de revisão indisponível são preservadas com aviso, inclusive sua duração histórica. A duração precisa continuar estruturalmente válida; só é comparada à definição quando a revisão corresponde. Mesclar backup aplica a guarda de revisões aos pacotes substituídos e aos pacotes preservados que receberiam personagens novos. Pacote conflitante ignorado sem personagens novos não altera as regras locais. Restaurar integralmente um backup coerente e confirmado permite retornar a uma revisão anterior, substituindo juntos sistemas e personagens.

Traços temporários, dados em degraus, Ascensão autoral, scripts, cronômetros, concentração, automação narrativa e custos novos estão fora deste motor. A assistência autoral existente permanece independente.
