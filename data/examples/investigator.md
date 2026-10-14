# Caderno de investigação

Este [pacote de exemplo](investigator.package.json) oferece perícias por referência, percentis e recursos preenchíveis em Padrão e Mesa. Sua lógica foi construída desde vazio pelos controles de Compor; ela usa operações gerais e a primitiva limitada de percentil com unidade compartilhada.

Adicione uma perícia, informe seu percentual entre 0 e 100 e selecione-a em Perícia selecionada. Saldo de bônus admite -2 a +2: zero usa uma dezena, valores positivos escolhem o menor candidato e negativos o maior. Os candidatos compartilham a unidade; 00 corresponde a 100. Os limites difícil e extremo usam o piso de metade e quinta parte do percentual. A mesa escolhe a dificuldade e interpreta o resultado.

Cancelar uma prévia conserva a ficha. Confirmar Testar perícia registra o resultado e atualiza Último percentil. A marca de evolução continua sendo uma edição manual da entrada, sem compra ou aumento automático do percentual. Notas da mesa acompanham a consulta.

PV, PM, Sanidade, Sorte e seus máximos são preenchidos pela mesa. O exemplo não gera um investigador automaticamente nem desconta esses recursos ao testar uma perícia. Características, armas, pertences, histórico e condições também continuam preenchíveis.

Testes forçados/opostos, gastos de Sorte, perdas de Sanidade e regras de críticos/desastres exigem configuração e decisão da mesa; este pacote não automatiza essas ampliações. Consulte a [cobertura dos sistemas adicionais](additional-systems.md) para distinguir o recorte assistido do livro completo.

Os dois layouts usam os mesmos dados e referências. Exportar/reimportar o personagem preserva entradas, marcas, valores opcionais e registros. Recarregar ou importar conserva faces históricas; executar um novo teste cria um registro novo. Consulte [ações tipadas](action-flows.md), [histórico](history.md) e [backup](catalog.md).
