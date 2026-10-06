# Orientação para agentes neste repositório

Este arquivo aponta para a memória do projeto; não autoriza executar tarefas futuras sem pedido do usuário.

## Leitura inicial

Leia `README.md`, `docs/private/continuidade.md` e `docs/private/arquitetura.md` ao retomar. Para componentes/layouts, leia `docs/private/componentes.md`; para regras autorais, `docs/private/sistema-rpg.md`; para D&D, `docs/private/dnd-parity.md`. Inspecione os arquivos reais pertinentes antes de editar: a documentação pode envelhecer.

A memória, os planos e os relatórios são privados e ignorados pelo Git em `docs/private/`; não os inclua em commits nem em hospedagem. Em um clone sem esses arquivos, consulte README e código; peça apenas o contexto necessário à tarefa quando faltar informação. Não recrie ou exponha a memória privada para corrigir links públicos.

## Invariantes

- Preserve a ficha D&D estática como referência, a modular e o modo de comparação com dados sincronizados.
- Separe sistema, layout e personagem; componentes devem ser reutilizáveis quando suas regras forem compatíveis.
- Não há exigência geral de retrocompatibilidade pré-produção, mas preserve dados e alterações do usuário.
- Ficha assistida não significa automação integral. Não invente custos ou decisões narrativas ausentes do livro.
- Edição direta durante jogo não cobra evolução automaticamente. Criação, evolução paga e narrativa têm registros separados.
- Teste mudanças funcionais com Playwright e confira temas/responsividade quando relevantes. Não rode suítes concorrentes na porta 4173.
- Não publique referências privadas em `docs/references/`. `.gitignore` não as protege se a pasta inteira for hospedada.
- Não altere a licença não comercial, abra o RPG ou prometa proteção jurídica garantida sem nova decisão do usuário. Consulte `LICENSE`, `docs/private/licensing.md` (quando disponível) e `THIRD_PARTY_NOTICES.md`.
- A busca na ficha atual inteira está implementada em `js/engine/search.js` e `js/sheet-search.js`; consulte `docs/private/busca-e-temas.md`. Ajustes aditivos/fixos existem nos cálculos compatíveis, via `js/engine/calculation-overrides.js`; não significam override universal. Editor JSON com prévia e editor visual continuam propostas, sem autorização automática.

Atualize a documentação quando contratos, escopo ou decisões mudarem. Relate verificações realizadas e diferencie testes atuais de resultados históricos.
