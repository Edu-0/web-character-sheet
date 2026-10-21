# Fundo e transparência

Em **Configurações → Cores**, as dezessete paletas têm versões clara e escura. Os nove conjuntos temáticos oferecem três ornamentos cada:

| Paleta | Acabamento | Ornamentos |
| --- | --- | --- |
| LGBT · Orgulho | Ametista e detalhes em arco-íris | Arco, estrela e laço do orgulho |
| Trans | Azul, rosa e branco nos detalhes | Faixa, órbita e asas trans |
| Sangue | Carmesim e superfícies escuras | Gota rubra, selo carmesim e espinhos |
| Horror cósmico | Verde espectral e violeta | Olho do abismo, tentáculos e portal |
| Sci-fi | Ciano e azul orbital | Circuitos, núcleo estelar e mapa orbital |
| Pergaminho | Papel marfim e tinta sépia; tons quentes no escuro | Pena, livro e iluminura |
| Oceano | Azul profundo e espuma; superfícies claras frias | Ondas, rosa dos ventos e concha |
| Solarpunk | Verde e luz dourada; superfícies claras discretas | Folha solar, sol e comunidade, jardim conectado |
| Frutiger Aero | Azul, verde, reflexos e vidro sobre céu/água | Bolhas de vidro, planeta azul, água e natureza |

**Aplicar ornamentos deste tema** substitui a combinação atual, preservando sua intensidade. Selecionar apenas a paleta mantém a decoração escolhida. Na aba **Ornamentos**, misture livremente as 36 artes em até três posições; desativá-las conserva a combinação. Desenhos novos são vetores geométricos locais, sem carregamento externo. Cores de bandeiras ficam em detalhes decorativos; texto e controles usam cores próprias para leitura.

Para **Frutiger Aero**, escolha a paleta em **Cores** e combine com **Translúcido** em **Fundo**, usando tintura **Acompanhar a paleta**. **Mega translúcido** deixa a cena mais evidente. O tema tem versões clara e escura, títulos sem serifa, reflexos nos botões principais e uma cena estática em CSS com céu, água, verde e bolhas. O brilho das janelas usa os materiais compartilhados; no escuro, o vidro translúcido recebe um filtro tonal para conservar a leitura sobre fundos claros. Inputs mantêm fundo próprio, e o foco de teclado permanece visível. A paleta não troca automaticamente o material nem os ornamentos.

O acabamento se inspira nos motivos de brilho, natureza e transparência catalogados pelo [CARI](https://cari.institute/aesthetics/frutiger-aero) e no vidro descrito pela [Microsoft para o Aero](https://news.microsoft.com/source/2006/02/26/microsoft-unveils-windows-vista-product-lineup/). A cena e os desenhos são originais em CSS/SVG, sem usar imagens das referências, fontes externas ou logos. Redução manual/do dispositivo e cores forçadas retiram a cena de vidro e os reflexos; navegadores sem filtros mantêm os fundos opacos das janelas. Impressão conserva o papel. A prévia isolada do editor recebe o mesmo acabamento e respeita sua paleta local.

**Alto contraste** usa limites definidos, foco de teclado explícito, links sublinhados e superfícies opacas sem desfoque. A preferência de vidro fica salva, mas suspensa nessa paleta, inclusive na prévia do editor quando ela usar Alto contraste. A escolha de ornamentos é preservada e pode ser desativada separadamente. Os tokens de texto de leitura miram pelo menos 7:1 nas superfícies principais, conforme a [orientação de contraste ampliado da W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html); isso não constitui certificação de toda a interface.

**Daltônico · Azul e âmbar** oferece uma combinação alternativa que evita o par vermelho/verde nos destaques semânticos. Não é uma correção universal para todas as formas de daltonismo. Mensagens, símbolos, marcas de seleção e underline das abas continuam distinguindo estados, seguindo o princípio de [não depender somente de cor](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html). Essas duas paletas não aplicam uma decoração própria automaticamente.

No modo claro, o fundo off-white levemente rosado se distingue das superfícies brancas e da navegação sutil. Campos usam fundo quase branco e bordas mais definidas que as divisórias decorativas. As cores da paleta continuam em ações, seleção e destaques; Preto e branco conserva superfícies neutras. Pergaminho opta por marfim, Oceano por tons frios suaves e Solarpunk por um verde quase neutro; Alto contraste usa branco/preto e limites mais fortes. Pétalas usa destaque rosa com foco em `#9B5C86`. O modo escuro conserva seus fundos e cores, com acabamento pontual nos controles e no overlay das janelas.

Campos comuns têm cantos de 6px, padding horizontal de 12px e altura mínima de 44px para manter o alvo de toque existente. O foco usa uma borda e brilho discreto; botões e escolhas conservam indicadores de teclado. Estados hover, desabilitado e erro sinalizado pelo formulário compartilham os mesmos tokens. As transições dos controles duram 160ms e respeitam a redução de movimento; cores forçadas mantêm um indicador próprio e radios nativos.

Labels e abas ativas têm contraste e peso definidos. Valores calculados genéricos usam divisórias finas no modo claro, sem caixas adicionais; a faixa `stat-strip`, atualmente utilizada por D&D, reúne valores com fundo sutil. Recursos, campos e cálculos de outros sistemas recebem o acabamento compartilhado sem mudar sua organização. Impressão mantém os estilos de papel.

Em **Configurações → Fundo**, escolha como a aplicação apresenta suas superfícies:

- **Sólido** (padrão): janelas e barras opacas. O desfoque atrás das janelas e o material discreto dos menus podem continuar ativos.
- **Translúcido**: vidro fosco perceptível nas janelas, menus e barras, sobre um fundo tonalizado da própria aplicação. As superfícies principais deixam aparecer parte dessa tonalidade sem acrescentar cards.
- **Mega translúcido · experimental**: acabamento mais exagerado, com vidro mais intenso, fundo mais colorido e botões secundários translúcidos. Campos de edição, botões primários e ações de perigo conservam fundos próprios. Labels sobre vidro recebem mais contraste.

A amostra em **Fundo** muda com a escolha. **Ver janela de exemplo** abre um modal real com o material atual e um campo somente leitura; fechar devolve o foco ao botão. A amostra não altera personagens ou sistemas. O efeito é interno ao aplicativo e continua independente do navegador.

Em **Tintura do vidro**, escolha **Acompanhar a paleta**, **Neutro · sem tintura**, Rosa, Azul, Esmeralda, Carmesim ou Violeta. Intensidades **Suave**, **Média** e **Intensa** modificam a cor das superfícies, sem mudar a opacidade do modo ou colorir os campos de edição. Neutro desativa a intensidade. Os controles ficam indisponíveis em Sólido, com efeitos reduzidos ou na paleta Alto contraste, mantendo a escolha guardada. Paleta, tintura e ornamentos são independentes; a prévia isolada recebe a tintura sem substituir sua paleta local.

**Reduzir efeitos de transparência** torna as superfícies opacas e desativa desfoque. O status informa quando a redução está ativa, mesmo que Translúcido ou Mega continuem selecionados. A preferência de redução do dispositivo também é respeitada quando o navegador a disponibiliza. O modo escolhido permanece salvo para quando a redução for desligada. Em telas pequenas os filtros são mais leves; navegadores sem suporte aos filtros conservam superfícies sólidas. Cores forçadas também retiram o vidro; a impressão usa os estilos de papel.

As escolhas ficam nas preferências locais, separadas de personagens e pacotes, e são incluídas em **Exportar tudo**. A prévia isolada do editor recebe as escolhas e mantém fundo próprio. Impressão/PDF usa os estilos de papel, sem esses materiais.

O modo específico para transparência do navegador (Zen/Mica) foi removido. Preferências locais ou backups antigos com `backgroundMode: "browser"` são interpretados como **Sólido**, sem reescrever o backup nem alterar personagens, sistemas ou outras preferências. O aplicativo não configura efeitos externos do navegador.
