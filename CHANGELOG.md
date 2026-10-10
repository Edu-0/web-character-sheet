# Histórico de versões

## Alterações locais — item 14, 10 de outubro de 2026

- Autoria visual dos mecanismos atuais em Compor, reutilizando documento, operações, histórico, recuperação, sandbox e aplicação do editor existente. Toolbox por finalidade, inclusão guiada, seleção da definição original, movimento por nomes e arrasto direto para o canvas, com indicador de encaixe e atualização automática de stack/grid/flex.
- Dados e catálogos por nome, referências, construtores de fórmulas/condições/dados e receitas das famílias atuais de testes, entradas, ações, recuperação, efeitos, módulos assistidos, criação/evolução, repertório, Pool, técnicas e D&D.
- Inspector contextual, reparos explícitos, paginação, upload de imagens pelo compressor existente, ajuda, leitura do ensaio e organização/fechamento de layouts e pacotes.
- Cobertura e limites em [autoria visual](data/examples/editor-visual.md). Verificação atual: 128/128 Node; 375/380 Playwright na completa, que teve interrupção de energia relatada, seguidos de 15/15 retestes dos cinco casos afetados, sem alteração de código. Checks de referência, inventário, documentação, prévia e offline aprovados; nenhuma publicação. A ambição de autoria de qualquer sistema continua aberta, sem novas mecânicas, migração de personagens ou card informativo independente.

## 0.5.0 — 6 de outubro de 2026

Pré-lançamento que amplia os sistemas disponíveis e os contratos da engine. Reúne as entregas posteriores à v0.2.0; não houve releases públicas v0.3.0 ou v0.4.0.

### Funcionalidades

- Seis novos sistemas embutidos: Fate Acelerado, Cthulhu 7e, Blades in the Dark, Savage Worlds SWADE, Ironsworn e Ordem Paranormal. O aplicativo passa a oferecer oito sistemas e 16 layouts, com Padrão e Modo mesa para cada sistema.
- Painéis de testes configuráveis com fontes de campos, coleções ou fórmulas: 4dF, percentuais com bônus/penalidade, pools de d6, resistência, dados explosivos e desafios/progresso, conforme o sistema.
- Botões de teste junto a campos e entradas quando configurados, reutilizando os painéis e os valores atuais da ficha. Histórico de rolagens com configuração e resolução estruturadas, limitado a 20 resultados durante a sessão.
- Efeitos numéricos com ativação explícita e encerramento confirmado. O piloto Coringa de SWADE aplica +2 nos testes de traço e dano, preservando os valores-base e as decisões da mesa.
- Preparação e diagnóstico de documentos versionados, com validação de contratos e referências, normalização confirmada de aliases conhecidos e cópia recuperável do original.
- Referência pública de 29 componentes, gerada dos descritores utilizados pela validação, com exemplos importáveis e verificação de correspondência com o código.

### Correções e integridade

- Rolagens usam `crypto.getRandomValues()` com amostragem por rejeição para distribuir igualmente as faces; não recorrem a `Math.random()` se a API estiver indisponível.
- Documentos de versões futuras ficam protegidos contra sobrescrita. Substituições de sistemas importados conferem os personagens vinculados; pacotes inválidos são isolados sem ocultar os demais.
- Normalização limitada aos contratos conhecidos, preservando metadados opacos e recusando aliases contraditórios ou documentos inválidos antes de gravar.
- Mescla de backup verifica revisões de efeitos; instâncias encerradas preservam a duração histórica quando a definição muda.
- Validação de templates alinhada à de personagens, seleção de fontes sem colisão entre IDs e índices e reconhecimento do valor padrão documentado de `pointBudget`.
- Preparação de rolagens por entrada antes do pagamento e separação entre efeitos, custos e valores efetivos de recuperação.
- Cache offline atualizado para os oito sistemas e novos módulos; suíte reorganizada em testes unitários, percursos rápidos e regressão completa.

### Uso e limites

- D&D mantém as apresentações estática, modular e comparação com dados sincronizados; a assistência do RPG autoral continua disponível.
- Ordem Paranormal oferece uma ficha preenchível com regras e totais manuais. Os demais sistemas têm a cobertura descrita em [sistemas adicionais](data/examples/additional-systems.md); criação, evolução, custos e decisões narrativas não são automatizados integralmente.
- Versão do aplicativo e `schemaVersion` são independentes. Os documentos aceitam versões 1 e 2 conforme seus mecanismos; manifesto permanece em 1. Não há migração universal nem scripts executáveis fornecidos por pacotes.
- Efeitos cobrem modificadores numéricos compatíveis; não incluem traços temporários, Ascensão autoral ou automação de iniciativa e cartas.
- Dados continuam locais ao navegador, sem contas, backend ou sincronização. Use **Exportar tudo** para manter backups.
- Continua sem editor visual de sistemas/layouts. Instalação no sistema operacional e iOS/Safari em aparelhos físicos ainda não foram validados.
- A release distribui código-fonte; hospedagem de um site continua sendo uma etapa separada. Licença não comercial da engine e direitos dos conteúdos permanecem preservados.

Consulte [validação e preservação](data/examples/validation.md), [efeitos numéricos](data/examples/effects.md), [referência de componentes](data/examples/components-reference.md), [testes](data/examples/testing.md), [instalação e uso offline](data/examples/offline.md), [licença](LICENSE) e [avisos de terceiros](THIRD_PARTY_NOTICES.md).

## 0.2.0 — 3 de outubro de 2026

Pré-lançamento para experimentar a ficha e a engine local ao navegador. Os contratos dos pacotes ainda podem mudar durante o desenvolvimento.

### Funcionalidades

- Bibliotecas locais de personagens e sistemas, com importação/exportação de pacotes JSON.
- Fichas D&D estática, modular e comparação com dados sincronizados; ficha assistida do RPG autoral em desenvolvimento.
- Backup da biblioteca inteira, validação de importações, recuperação de falhas de armazenamento e processamento de retratos.
- Ajustes aditivos ou fixos de cálculos compatíveis, com retorno ao automático.
- Layouts múltiplos por sistema e modo mesa nos dois sistemas embutidos, compartilhando os mesmos personagens.
- Desfazer/refazer das edições por personagem durante a sessão, com botões e atalhos de teclado.
- Instalação como aplicativo quando oferecida pelo navegador e preparação para uso offline, incluindo os sistemas embutidos e layouts ainda não visitados.
- Rolagens e recuperações assistidas configuráveis, busca na ficha, temas claro/escuro e impressão completa/compacta.

### Correções e integridade

- Cache offline por versão e escopo, com verificação SHA-256 e ativação de atualizações após fechar todas as janelas antigas.
- Compatibilidade com a injeção de recarga do Live Server e Five Server em loopback, preservando os bytes originais verificados no cache.
- Mensagens de preparação offline identificam o arquivo e a causa da falha quando disponíveis.
- Hashes do runtime alinhados às quebras de linha LF do repositório para funcionar também em novos clones.

### Uso e limites

- Instalação/offline exige navegador compatível e contexto seguro. Após a primeira preparação com conexão, reabra o aplicativo para ativar o uso offline.
- Personagens e preferências ficam no navegador; não há contas, nuvem ou sincronização entre dispositivos/abas. Use **Exportar tudo** para backup e transferência entre endereços/perfis.
- Histórico de edições é transitório: até 50 operações/2 MiB por personagem e cache dos 10 personagens recentes. Recarregar, fechar ou restaurar a biblioteca reinicia esse histórico, preservando a ficha salva.
- Não inclui editor visual de sistemas/layouts ou automação integral de regras.
- Os testes usam Microsoft Edge; instalação no sistema operacional e iOS/Safari em aparelhos físicos ainda não foram validados.
- A release distribui o código-fonte. A publicação de um site com pacote próprio de arquivos públicos é uma etapa separada.

Consulte [instalação e uso offline](data/examples/offline.md), [histórico de edições](data/examples/history.md), [licença](LICENSE) e [avisos de terceiros](THIRD_PARTY_NOTICES.md).
