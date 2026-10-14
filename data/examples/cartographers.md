# Cartógrafos da Bruma

[Importe o pacote fictício](cartographers.package.json) em **Sistemas → Importar sistema**. Ele foi construído pelos controles de Compor, desde um pacote vazio, e oferece Padrão e Mesa. Os personagens de ensaio ficam separados do pacote exportado.

O exemplo reúne [dados estruturados](structured-data.md), [consultas](rule-queries.md), [ações](action-flows.md), [efeitos](typed-effects.md), [eventos](rule-events.md) e [progressão](progression-choices.md). Abra **Editar pacote → Compor** para consultar e alterar fontes, condições, preços e consequências.

## Preparar uma expedição

Adicione um ofício e marque **Habilitado**. Escolha a rota: Curta custa 1 Tinta e tem risco 2; Profunda custa 3 e tem risco 4. Explorar exige um ofício habilitado e Tinta suficiente, ou um salvo-conduto resolvido. O salvo-conduto permite a ação; o pagamento declarado continua sujeito ao saldo disponível.

Equipamentos podem conter módulos. A carga soma somente os módulos equipados: pesos 2 e 3 contribuem 5; um módulo desequipado de peso 9 não contribui. Reordenar entradas conserva suas identidades e relações.

**Explorar a Bruma** lança quatro dados de Sondagem, mantém os três maiores e conta faces a partir de 5. Uma face 1 pode ser rerrolada uma vez, por escolha do jogador. Zero sucessos significa falha; um, resultado parcial; dois ou três, sucesso.

Vínculos custa 1 na confirmação. Tinta custa o preço da rota somente no sucesso. Com Tinta 5 e Vínculos 2 na rota Profunda, sucesso deixa 2/1 e falha deixa 5/1. Sucesso acrescenta 2 Rastros e uma descoberta com identidade própria. Cancelar a prévia conserva recursos e descobertas. A mesa descreve a descoberta e decide o significado narrativo do resultado.

## Efeito e especialização

**Lente** projeta Sondagem de d6 para d8 por uma resolução confirmada, preservando a base d6. Cancelar uma prévia não consome esse uso. **Outra lente** demonstra o diagnóstico de duas substituições incompatíveis com a mesma prioridade; resolver o conflito exige uma escolha explícita.

Quando uma ação faz Rastros cruzar 5, uma proposta de **Especialista** fica guardada uma vez por personagem. A proposta permanece indisponível enquanto houver menos de dois ofícios habilitados. Com os requisitos atendidos e a criação concluída, sua revisão permite pagar 2 Rastros e adquirir a permissão de **Traçar mapa especializado** com um uso. Preço, benefícios e origem ficam no registro de progressão; edição direta não realiza essa compra. Depois de gastar o uso, a ação fica indisponível.

## Reuso e variantes

Os dois primeiros compostos Ofício têm referências independentes. A consulta compartilhada mostra a referência do primeiro. A cópia da definição tem apresentação independente, com seu binding explícito. O grupo repetido mostra a habilitação das entradas atuais da coleção.

**Sinal explosivo** usa d6 com teto de duas explosões: 6, 6 e 2 produzem 14. Exceder o teto recusa o resultado. **Ler presságio** classifica a soma de 2d6 em desfavorável (2–6), incerto (7–9) e favorável (10–12). Essas variantes usam o mesmo editor de resoluções.

Desfazer/refazer reaplica os valores e registros guardados, sem novo lançamento. Exportar o personagem conserva descobertas, referências, efeitos, propostas e concessões. Recarregar ou importar não reproduz eventos antigos. Consulte também [histórico e limites](history.md) e [backup da biblioteca](catalog.md).
