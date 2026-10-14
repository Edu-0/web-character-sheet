# Caderno de aventuras

Este [pacote fictício](adventurers.package.json) demonstra cálculos e ações construídos pelos controles de Compor desde vazio, com Padrão e Mesa. Não contém personagens de ensaio nem catálogos de classes, magias ou criaturas de um livro.

Adicione atributos e vincule cada perícia/resistência ao atributo escolhido. O modificador é piso((valor − 10)/2); proficiência é 2 + piso((nível − 1)/4). O treino acrescenta zero, uma ou duas proficiências, além do bônus manual. Escolha as fontes de carga, iniciativa, cura e conjuração. Os cálculos usam referências por identidade; renomear ou reordenar atributos conserva seus vínculos.

Ataque e dano são ações separadas. Magias têm dados, modificador, escala por espaço e preferência explícita de consumo. Truques não consomem espaços; uma magia sem dados também pode ser lançada. Os espaços armazenam máximo/usados: máximo 3 com usado 1 deixa 2 disponíveis. Nenhum resultado decide automaticamente acerto ou dano causado em outra ficha.

A carga soma quantidade × peso dos itens. Moedas são convertidas para ouro pela tabela editável do pacote: uma platina e cinco electros resultam em 12,5 ouros. A capacidade usa o valor da fonte escolhida × 7,5.

Descanso curto permite lançar ou informar um dado de vida, somar o modificador da fonte de cura e confirmar a recuperação limitada ao máximo. PV 5/12 com d8=4 e modificador +2 resulta em 11, com um dado gasto. Descanso longo restaura PV, dados de vida, espaços e usos marcados, e zera PV temporários. A mesa decide se o descanso pode ocorrer e quaisquer exceções.

Condições e notas são manuais. Classes, duração dos efeitos, exaustão e exceções de recursos exigem configuração e decisões da campanha. Este exemplo demonstra autoria genérica; a ficha D&D original continua disponível nas apresentações estática, modular e comparação.

Cancelar conserva os valores. Desfazer/refazer restaura valores e registros sem novas faces. Os dois layouts compartilham os mesmos dados; exportar/reimportar o personagem preserva entradas, referências e registros. Consulte [ações](action-flows.md), [recuperação](recovery.md) e [histórico](history.md).
