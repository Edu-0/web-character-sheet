# Validação e preservação de documentos

Versões aceitas: manifesto 1; pacote/sistema/layout 1, 2 e 3; personagem 1, 2 e 3; backup 1 e 2. O [contrato v3 de dados tipados e cálculos](typed-data.md) exige envelope v3, com habilitação explícita; abrir v1/v2 não converte fórmulas ou versões. Valores escalares não exigem nova versão de personagem; registros persistidos de [ações tipadas](action-flows.md) usam personagem v3 com habilitação explícita. Backup com pacote v3 usa envelope 2.

Sistema, layout, personagem e pacote são documentos distintos. `schemaVersion` identifica seu formato; a versão do aplicativo e o namespace do armazenamento não são versões desses documentos.

`prepareDocument` em `js/validation/documents.js` verifica limites, versão, contratos e referências sem alterar a entrada. Retorna `ready`, `needsMigration`, `unsupported` ou `invalid`, com diagnósticos de severidade, código, caminho e JSON Pointer. A referência por ponteiro respeita chaves literais com ponto. O limite de 200 diagnósticos produz um erro explícito de truncamento.

Referências de catálogo ausentes são diferentes de catálogos vazios. Os layouts são conferidos em conjunto: colisões entre cálculos com a mesma chave de ajuste são recusadas; referências de item removidas permanecem nos dados e podem ter aviso. Os contratos assistidos têm validação própria. Isso não valida integralmente a construção ou todas as regras de um livro.

A importação oferece prévia e confirmação quando converte os aliases conhecidos de rolagens para os nomes atuais. A transformação trabalha em cópia, preserva campos extras e guarda o original na recuperação na mesma transação da gravação. Valores contraditórios entre nomes antigos/novos exigem correção. Abrir uma ficha não reescreve seu pacote. Os migradores são funções do aplicativo; um pacote não fornece código executável.

A normalização percorre somente locais do contrato: definições de entryRolls, componentes de lista com ação de rolagem e opções das entradas consumidas pelos layouts do pacote. Não procura aliases recursivamente em metadados. Sem o pacote do personagem, suas coleções permanecem intactas; ter uma propriedade chamada rollOptions não demonstra que ela seja uma configuração de rolagem. Preparação inválida ou versão não suportada impede a importação antes de qualquer gravação. Aliases contraditórios também são recusados sem solicitar normalização.

Propriedades não expostas pela interface permanecem no documento. Objetos de regras com opções desconhecidas podem ser recusados para impedir interpretação incorreta; o original continua no arquivo importado ou na recuperação dos dados locais. `extensions` é o espaço de metadados opacos nos contratos estritos de rolagem/recuperação. Não movemos automaticamente dados antigos para esse espaço.

Um pacote local indisponível não oculta os demais. Documentos locais de versões futuras ficam protegidos contra sobrescrita e visíveis para exportação do original. Antes de substituir um sistema importado, validamos todos os personagens vinculados, incluindo o personagem ativo recebido pelo aplicativo. A substituição incompatível é recusada e a cópia anterior fica recuperável quando a substituição confirmada é gravada.

O characterTemplate é validado contra os mesmos consumidores do personagem, incluindo definições/revisões, duplicidade e grupos de efeitos. O ID do personagem pode estar ausente no template e é atribuído ao criar a ficha. Valores padrão declarados, como configFrom = pointBudget, são resolvidos pelo mesmo descritor usado na referência e no runtime.

As cópias e o journal exigem espaço adicional. Falha de gravação mantém dados em memória. O journal permite rollback; a coordenação de escrita entre abas usa locks e verificação dos clientes, com releitura antes da substituição. Migração e restauração exigem também fichas sem edições pendentes nas outras janelas. Isso não oferece edição colaborativa ou mesclagem automática. A [migração explícita de dados](data-migration.md) permite revisar conversões e restaurar a cópia original somente enquanto as guardas do estado posterior forem satisfeitas; não há reversão automática ao abrir. Backup, exportação individual e recuperação conservam seus papéis próprios.

Os testes Node verificam contratos e transformações; Playwright verifica importação, confirmação, substituição, quota e exportação. Os guias de [histórico de edições](history.md), [biblioteca e backup](catalog.md) e [offline](offline.md) descrevem ciclos independentes.
