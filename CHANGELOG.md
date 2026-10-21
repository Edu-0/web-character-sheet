# Histórico de versões

## Em desenvolvimento

- Distribuição Windows x64: executável portátil com perfil ao lado do arquivo e instalador por usuário com perfil estável, ambos com a aplicação pública completa e uso offline imediato.
- Gerador `.exe` independente de Git/Node instalados: baixa um snapshot do `main`, Node.js 22 LTS com verificação SHA-256 e dependências do lockfile para produzir novos executáveis sem armazená-los nos commits. Geração local e GitHub Actions também disponíveis.
- Desktop usa origem interna estável, renderer isolado e arquivos públicos permitidos; atualização explícita pelo gerador mantém a persistência existente. Bibliotecas do navegador, portátil e instalado são transferidas por backup.

## 0.8.0 — 20 de outubro de 2026

Pré-lançamento. [Release e downloads](https://github.com/Edu-0/web-character-sheet/releases/tag/v0.8.0).

- Criação de sistemas organizada em Visão geral, Ficha, Dados, Regras, Testar e Revisar. Editores JSON, por formulários e visual compartilham documento, histórico, validação, rascunhos e aplicação pela biblioteca. Primeiro elemento orientado, propriedades progressivas, atalhos, menu de contexto e JSON flutuante somente leitura.
- Autoria de dados tipados, vínculos, registros, coleções, consultas, ações, eventos, efeitos e progressão no escopo documentado. Ensaio isolado, exportação de pacotes e migração explícita preservam as decisões manuais da mesa.
- Cabeçalho e catálogo compactos, superfícies mais contínuas e listas de ataques, magias e habilidades em modo de leitura com lápis e Salvar/Cancelar. Controles rápidos continuam na ficha. A edição conserva rascunho e foco em remontagens compatíveis, sem perder conflitos ou mudanças em outros campos.
- Dezessete paletas claras/escuras e 36 ornamentos opcionais. Inclui LGBT · Orgulho, Trans, Sangue, Horror cósmico, Sci-fi, Alto contraste, Daltônico · Azul e âmbar, Pergaminho, Oceano, Solarpunk e Frutiger Aero. Selecionar paleta preserva a decoração escolhida; os conjuntos de ornamentos são aplicados explicitamente.
- Materiais Sólido, Translúcido e Mega translúcido experimental, com tinturas independentes e janela de exemplo. Campos e ações principais conservam fundos próprios. Alto contraste suspende vidro sem apagar a preferência; redução de efeitos e cores forçadas preservadas. Frutiger Aero acrescenta céu, água, bolhas, reflexos e acabamento compartilhado com a prévia. O modo específico Zen/Mica foi retirado; valores legados usam Sólido.
- Atualização offline com aviso global, salvamento de ficha/rascunho e coordenação entre abas antes de recarregar. Verificação manual mostra progresso, confirmação e diagnóstico; reparos compartilham uma fila de quatro downloads, preservando hashes e aguardando até 30s pela resposta. Janela aberta, falha de gravação ou aba incompatível impede uma troca insegura.
- Five Server com raiz relativa ao workspace, corrigindo o caminho duplicado que causava HTTP 404. Novos arquivos de runtime entram no pacote offline; o aplicativo pode reabrir com as aparências e sistemas locais sem rede.
- Distribuição estática produzida por `npm run build:site`: aplicativo, guias públicos, licença, avisos das artes e de terceiros e metadados/hashes. Pacote e arquivos de desenvolvimento permanecem separados.

### Verificações e limites

- Rodada dirigida de publicação: 40/40 cenários aprovados, incluindo criação desde vazio, recuperação do rascunho, edição pelo lápis, persistência e atualização offline entre abas.
- Verificações mais recentes de aparência: 393/393 testes Node e rodada final limpa de 34/34 cenários de navegador, incluindo 17 paletas com vidro/tintura, responsividade, foco, redução, impressão, prévia e edição. Sem regressão nos módulos alterados instrumentados; pequenas variações no agregado de cobertura em módulos não modificados estão registradas nas verificações de desenvolvimento.
- Fechamento técnico anterior: 533 cenários únicos de navegador com último resultado aprovado em rodadas (529/533 + 4/4), sem alegação de uma integral única limpa. Três timeouts de inicialização/montagem não reapareceram no dirigido, com causa não confirmada; um teste passou a aguardar os dados após reload. As revisões posteriores de offline e temas receberam suas verificações dirigidas.
- Zoom nativo 200% verificado em perfil isolado, com 60 campos e os dois modos. Jornada de criação desde um sistema vazio até rascunho, instalação e uso de personagem coberta. Uso offline conferido também no Five Server real da porta 5500, em perfil isolado.
- Interface pt-BR. Celular verificado por emulação; avaliação com iniciantes, tecnologias assistivas e aparelhos físicos não realizada. Não há certificação universal de acessibilidade ou autoria universal de regras. A opção Daltônico oferece azul/âmbar, sem promessa de correção universal.
- Rascunho do lápis é temporário e não atravessa reload ou troca de personagem. Fichas e preferências continuam locais ao navegador/origem. Instalação não cria conta, nuvem ou backup.
- Licença não comercial e direitos separados de RPG, artes e conteúdo de terceiros preservados. O projeto é independente e não oficial; a licença do código não abre livros, marcas ou desenhos nem certifica sua proveniência integral.

## Configuração local — Five Server, 19 de outubro de 2026

- Configuração do Five Server para abrir a raiz do projeto em 127.0.0.1:5500, com instruções de início e atualização do cache offline no README. Sem alteração no aplicativo ou nos dados.

## Alterações locais — integração no principal, 19 de outubro de 2026

- Interface geral, temas, materiais, edição pelo lápis e editor de sistemas reunidos no checkout principal, incluindo atalhos, menu contextual, JSON flutuante e inclusão orientada.
- Fluxo de atualização do aplicativo integrado: aviso global, salvamento de ficha/rascunho e coordenação das abas antes de recarregar.
- Arquivos de referência, capacidades, prévia e modo offline reconstruídos no destino. Integração local sem publicação ou nova versão lançada.
- Aviso de atualização distingue uma versão nova da primeira instalação offline, evitando a oferta transitória de uma atualização inexistente.

## Alterações locais — atualização do aplicativo, 19 de outubro de 2026

- Nova versão anunciada na ficha e no editor com Atualizar agora/Depois, além de Configurações; verificações ao voltar ao app, reconectar e periodicamente enquanto visível.
- Ativação coordenada entre abas, preservando alterações de ficha e rascunhos pendentes antes da recarga. Janela de edição aberta, falha de gravação ou aba antiga sem resposta bloqueia a troca e permite tentar novamente.
- Preparação inicial completa ativa o modo offline sem exigir reabrir manualmente. Caches continuam isolados por aplicativo/escopo e versão; documentos do usuário não são apagados.

## Alterações locais — auditoria de design, 19 de outubro de 2026

- Cabeçalho móvel do editor mais compacto: ações e navegação permanecem em uma linha cada, com mensagem de pendência mais curta e acesso a Código.
- Menu contextual mantém o painel de origem e a ficha visível; Escape devolve foco e Editar propriedades abre o inspector explicitamente.
- Cálculos em pacotes antigos agora explicam o requisito de dados tipados e oferecem acesso à configuração, sem conversão ao navegar.

## Alterações locais — integração de design, 19 de outubro de 2026

- Modais comuns limitados à altura disponível, inclusive no ensaio do editor: conteúdo rola internamente e ações permanecem acessíveis.
- Navegação dos testes atualizada para as seis áreas, mantendo as verificações de dados, cancelamento, recuperação e aplicação.

## Alterações locais — atalhos e inclusão orientada, 18 de outubro de 2026

- Primeiro elemento com formulário central aberto, instruções, revisão de inclusão também no cabeçalho, sem arrasto durante esse início; cancelamento preserva a configuração.
- Delete, duplicar, renomear, incluir, propriedades e ajuda por teclado, com proteção de digitação, IME, pendências e modais. Menu de contexto na árvore e no canvas, também por Shift F10.
- JSON flutuante somente para leitura, atualizado com o documento, movível e redimensionável, mantendo a autoria acessível.
- Grupos de propriedades mantêm sua abertura durante a sessão. Atualizações de feedback preservam a rolagem e a seleção de sistema/pacote ao voltar de Testar, sem perder textos pendentes.
- Divisor JSON/prévia em faixa própria, sem cobrir controles da amostra. Rótulos de impressão contextualizados, com os mesmos valores do pacote.
- Erros de configuração continuam visíveis durante salvamento e atualização automáticos; uma nova edição inicia a próxima tentativa.
- Nome acessível das janelas de confirmação associado ao título. Cabeçalho reorganizado sob ampliação, navegação global oculta durante autoria e limites do menu/JSON ajustados à escala da interface. Trabalho local de integração, sem nova release.


## Alterações locais — espaço de autoria, 18 de outubro de 2026

- Editor organizado em Visão geral, Ficha, Dados, Regras, Testar e Revisar. Cabeçalho contextual com Arquivo e acesso a Código e propriedades; construtores amplos e opções progressivas.
- Ficha e ferramentas compartilham a altura da janela, com rolagens locais, destino de inclusão e painéis adaptados ao celular. Salvamento não desloca o canvas durante o arrasto.
- Mantidos documento, histórico, confirmação por campo, recuperação, ensaio isolado, migração e aplicação pela biblioteca. [Guia de criação e edição](data/examples/editor-workspace.md).
- Trabalho local de desenvolvimento; não altera a versão publicada nem representa avaliação humana de usabilidade.

## Revisão documental local — 18 de outubro de 2026

- Guias de autoria, validação, versões, migração, offline e testes alinhados ao fechamento técnico da autoria geral. Navegação dos exemplos reorganizada e estados históricos identificados.
- Revisão apenas documental: preserva runtime, testes, versão do pacote e cache offline. Os resultados funcionais de 15/10 abaixo continuam históricos; não houve nova release ou publicação.

## Alterações locais — fechamento técnico da autoria geral, 15 de outubro de 2026

- Autoria desde pacote vazio com dados tipados compartilhados, consultas, ações, gatilhos, efeitos e criação/evolução. Os exemplos fictícios Aventuras, Investigação, Cartógrafos e Traços exercitam execução e exportação/reimportação. [Verificações e limites](data/examples/authoring-validation.md).
- 373 testes Node aprovados. Os 486 casos Playwright foram conferidos sob os mesmos hashes em duas execuções: 296 antes de uma pausa solicitada e 190 na retomada, sem falhas. Referência, inventário, links, prévia e offline conferidos.
- Avaliações humanas, dispositivos físicos e tecnologias assistivas continuam pendentes. Casos extremos medidos podem ultrapassar 500 ms; não há SLA geral.

## Alterações locais — robustez da autoria, 15 de outubro de 2026

- Proteção de fichas não salvas limitada à migração/restauração; exclusão comum entre abas preserva a edição em memória. O salvamento automático do rascunho conserva avisos de erro até a próxima ação ou edição.
- Revisão de migração com progresso e cancelamento, usando o mesmo plano puro do instalador. Texto inválido e correspondências preservam identidades durante outras alterações; opções incompatíveis de rascunho exigem descarte explícito.
- Medições reproduzíveis de consultas, cache, grafo e migração, com tetos documentais e verificações offline em subpasta. [Verificação e limites](data/examples/authoring-validation.md).

## Alterações locais — migração instalada, 15 de outubro de 2026

- Revisão visual de dados por personagem, conversões limitadas, conflitos e restauração com guardas sobre pacote e biblioteca. Gravação conjunta pelo coordenador/journal existentes; abertura não converte e o catálogo original é preservado. [Uso, contratos e limites](data/examples/data-migration.md).
- Revisão opcional dos dados em v3 protege importações de outra versão de bindings; clientes antigos impedem a substituição; fichas não salvas em outras janelas impedem migração/restauração conjunta. Sem conversão universal de históricos de jogo.
## Alterações locais — acabamento dos temas, 14 de outubro de 2026

- Claro com off-white suave, campos quase brancos e bordas mais definidas, navegação distinta e divisórias discretas. Destaques das paletas preservados; Pétalas aproxima o rosa da referência e Preto e branco permanece neutro.
- Controles compartilhados com foco único, estados hover/desabilitado/erro coerentes, transições de 160ms e fallback para cores forçadas. Radios desmarcados mais legíveis, com a mesma seleção por teclado.
- Agrupamento leve de estatísticas D&D e calculados genéricos de outros sistemas. Escuro mantém sua paleta, recebendo bordas de campos mais legíveis e pequena redução no overlay dos modais. Sem alterações de dados ou regras.

## Alterações locais — foco, escolhas e superfícies claras, 14 de outubro de 2026

- Tema claro com superfícies neutras nas seis paletas, mantendo suas cores nos destaques; tonalização interna mais leve. Campos mais distintos do fundo no modo escuro.
- Foco de campos com uma borda e brilho discreto; cantos de painéis/janelas menos arredondados. Salvar/Cancelar permanecem visíveis em janelas de entradas longas.
- Escolhas exclusivas usam radios, com Ajuste manual explícito. Checkboxes permanecem para escolhas independentes. Nome legado de apresentação preservado como alias, sem reescrever dados ao abrir.

## Alterações locais — leitura e edição de entradas, 14 de outubro de 2026

- Listas com `editMode: dialog` mostram valores como texto e oferecem edição pelo lápis, com rascunho e Salvar/Cancelar; novas entradas só são cadastradas ao salvar.
- `quickFields` mantém controles de sessão diretamente na ficha. Opções disponíveis nos formulários do editor, com validação das referências aos campos.
- Aplicado a ataques, magias, habilidades e listas relacionadas nos layouts embutidos. Inventários/tabelas continuam com edição direta, e cópias locais editadas são preservadas.
- Salvamento preserva identidade/propriedades adicionais, recusa conflitos e confere condições de edição. Busca, histórico, impressão e ensaio isolado acompanham a apresentação.

## Alterações locais — materiais e preferências, 14 de outubro de 2026

- Configurações → Fundo com modos Sólido, Translúcido e Usar transparência do navegador, salvos nas preferências e incluídos no backup.
- Materiais discretos em menus e janelas, redução manual ou do dispositivo e fallback sólido; impressão com apresentação própria.
- Prévia isolada acompanha materiais e conserva fundo próprio no modo de navegador transparente. Compatibilidade nativa específica do navegador ainda não verificada.

## Alterações locais — composição da interface, 14 de outubro de 2026

- Catálogo como ícone acessível e navegação superior com ações distribuídas; menu Mais abaixo de 1280 px.
- Superfície contínua da ficha modular, títulos com hierarquia e listas com divisórias leves, preservando campos e operações.
- Biblioteca e catálogo em linhas; estados e comandos mantidos, com menor destaque para exclusão.
- Modo mesa com ritmo compacto, inclusive na prévia isolada do editor. Impressão e referência D&D estática conservam seus estilos próprios.

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
