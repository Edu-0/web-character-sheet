# Orientação para agentes neste repositório

Este arquivo aponta para a memória do projeto; não autoriza executar tarefas futuras sem pedido do usuário.

## Leitura inicial

Leia `README.md`, `docs/continuidade.md` e `docs/arquitetura.md` ao retomar. Para componentes/layouts, leia `docs/componentes.md`; para regras autorais, `docs/sistema-rpg.md`; para D&D, `docs/dnd-parity.md`. Inspecione os arquivos reais pertinentes antes de editar: a documentação pode envelhecer.

## Invariantes

- Preserve a ficha D&D estática como referência, a modular e o modo de comparação com dados sincronizados.
- Separe sistema, layout e personagem; componentes devem ser reutilizáveis quando suas regras forem compatíveis.
- Não há exigência geral de retrocompatibilidade pré-produção, mas preserve dados e alterações do usuário.
- Ficha assistida não significa automação integral. Não invente custos ou decisões narrativas ausentes do livro.
- Edição direta durante jogo não cobra evolução automaticamente. Criação, evolução paga e narrativa têm registros separados.
- Teste mudanças funcionais com Playwright e confira temas/responsividade quando relevantes. Não rode suítes concorrentes na porta 4173.
- Não publique referências privadas em `docs/references/`. `.gitignore` não as protege se a pasta inteira for hospedada.
- Não altere a licença não comercial, abra o RPG ou prometa proteção jurídica garantida sem nova decisão do usuário. Consulte `LICENSE`, `docs/licensing.md` e `THIRD_PARTY_NOTICES.md`.
- Busca global, override universal de cálculos e editor visual são propostas, não funcionalidades prontas ou tarefas automaticamente autorizadas.

Atualize a documentação quando contratos, escopo ou decisões mudarem. Relate verificações realizadas e diferencie testes atuais de resultados históricos.
