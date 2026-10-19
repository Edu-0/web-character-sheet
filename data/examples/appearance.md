# Fundo e transparência

No modo claro, o fundo off-white levemente rosado se distingue das superfícies brancas e da navegação sutil. Campos usam fundo quase branco e bordas mais definidas que as divisórias decorativas. As cores da paleta continuam em ações, seleção e destaques; Preto e branco conserva superfícies neutras. Pétalas usa destaque rosa com foco em `#9B5C86`. O modo escuro conserva seus fundos e cores, com acabamento pontual nos controles e no overlay das janelas.

Campos comuns têm cantos de 6px, padding horizontal de 12px e altura mínima de 44px para manter o alvo de toque existente. O foco usa uma borda e brilho discreto; botões e escolhas conservam indicadores de teclado. Estados hover, desabilitado e erro sinalizado pelo formulário compartilham os mesmos tokens. As transições dos controles duram 160ms e respeitam a redução de movimento; cores forçadas mantêm um indicador próprio e radios nativos.

Labels e abas ativas têm contraste e peso definidos. Valores calculados genéricos usam divisórias finas no modo claro, sem caixas adicionais; a faixa `stat-strip`, atualmente utilizada por D&D, reúne valores com fundo sutil. Recursos, campos e cálculos de outros sistemas recebem o acabamento compartilhado sem mudar sua organização. Impressão mantém os estilos de papel.

Em **Configurações → Fundo**, escolha como a aplicação apresenta suas superfícies:

- **Sólido** (padrão): fundo estável. Menus e janelas podem usar desfoque discreto.
- **Translúcido**: fundo tonalizado da própria aplicação e translucidez leve no cabeçalho. Campos e áreas de leitura mantêm fundos estáveis.
- **Usar transparência do navegador**: permite fundo transparente na página, com proteção comum para a leitura. Requer um navegador configurado para páginas transparentes; transparência somente na barra do navegador não produz esse efeito na página. Esta opção não ativa Mica nativo, não detecta o navegador e não acessa o papel de parede.

**Reduzir efeitos de transparência** torna as superfícies opacas e desativa desfoque. A preferência de redução do dispositivo também é respeitada quando o navegador a disponibiliza. O modo escolhido permanece salvo para quando a redução for desligada. Em telas pequenas os filtros são mais leves; navegadores sem suporte aos filtros conservam superfícies sólidas.

As escolhas ficam nas preferências locais, separadas de personagens e pacotes, e são incluídas em **Exportar tudo**. A prévia isolada do editor recebe as escolhas, mas mantém fundo próprio quando a página usa transparência do navegador. Impressão/PDF usa os estilos de papel, sem esses materiais.

Transparência real depende do navegador e do sistema operacional. A implementação prepara a página; compatibilidade nativa com configurações específicas de Zen ou outros navegadores não foi certificada.
