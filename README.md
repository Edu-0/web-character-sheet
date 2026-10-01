# RPG Character Sheet

> Uma ficha de personagem web moderna, modular e extensível para RPGs de mesa.

## 🚧 Status

**Em desenvolvimento — fase 7: paridade da ficha D&D modular**

O projeto já possui uma engine declarativa, biblioteca local de sistemas e personagens, temas claro/escuro e testes de interface com Playwright.

A primeira versão está sendo desenvolvida como uma **ficha de personagem web baseada em HTML, CSS e JavaScript**, inicialmente inspirada na estrutura de D&D 5e 2024.

O D&D 5e (2024) abre pela ficha modular em navegadores novos. A ficha estática permanece isolada como referência, acessível pelo seletor junto ao modo de comparação lado a lado. A preferência e a aba ativa são preservadas no navegador.

---

## 🎯 Objetivo

Criar uma ficha que combine:

* design premium e contemporâneo;
* fantasia medieval discreta;
* excelente UX;
* responsividade;
* preenchimento digital;
* persistência local;
* cálculos automáticos;
* componentes reutilizáveis;
* arquitetura preparada para expansão.

A ideia é que a ficha possa eventualmente deixar de ser específica de um único sistema e passar a funcionar como uma camada de apresentação para diferentes sistemas de RPG.

---

## 🧪 Natureza do projeto

Este projeto começou como um experimento de **vibecoding/AI-assisted development**.

Grande parte da implementação inicial está sendo desenvolvida com auxílio de agentes de IA a partir de especificações, prompts e decisões de design/arquitetura fornecidas durante o desenvolvimento.

O código produzido por IA será posteriormente revisado, entendido e refatorado conforme a arquitetura do projeto amadurecer.

Este README também será atualizado à medida que o projeto evoluir.

---

## 🛠️ Tecnologias

A primeira versão utiliza:

* HTML5
* CSS3
* JavaScript (ES6+)
* CSS Grid
* Flexbox
* SVG
* LocalStorage

A intenção inicial é evitar frameworks e dependências desnecessárias.

---

## 🧩 Arquitetura atual

Uma das principais ideias do projeto é separar a **engine da ficha** da definição de um sistema específico.

Conceitualmente:

```text
Sistema de RPG
      ↓
Definição / Configuração
      ↓
Engine da ficha
      ↓
Componentes de UI
      ↓
Personagem
```

Cada sistema possui uma configuração JSON e um layout JSON. Os personagens são persistidos separadamente:

```text
data/systems/
├── dnd2024.system.json
├── dnd2024.layout.json
├── sistema-rpg.system.json
└── sistema-rpg.layout.json
```

O layout define abas, seções, containers e componentes. O renderizador genérico e o registro de componentes montam a ficha para qualquer sistema compatível. Componentes específicos de D&D ficam isolados em `js/systems/dnd2024-fields.js`.

A ficha estática permanece disponível para comparação, conforme a decisão do projeto. A matriz de paridade, as diferenças visuais menores e como regenerar as capturas estão em [docs/dnd-parity.md](docs/dnd-parity.md). A fase seguinte cobre conteúdo variável extremo e regressão final.

Para executar a aplicação localmente e os testes de interface: `npm install` e `npm run test:e2e`.

O Sistema de RPG possui uma ficha assistida: catálogo compacto de Perícias, orçamento e evolução, traços compostos, repertório e uso de Técnicas, carga, descansos, cura e ações de cena. O visual segue a variante editorial do livro de referência. A cobertura, os limites narrativos e as regras configuráveis estão em [docs/sistema-rpg.md](docs/sistema-rpg.md).

---

## 📋 Escopo inicial

A primeira versão está focada em uma ficha com:

* identidade do personagem;
* atributos;
* perícias;
* combate;
* ataques;
* habilidades;
* recursos;
* magias;
* inventário;
* equipamentos;
* personalidade;
* aparência;
* anotações;
* rolagem de dados;
* persistência local;
* importação/exportação;
* temas;
* impressão/PDF;
* layout responsivo.

O escopo poderá mudar conforme o protótipo for testado.

---

## 🎨 Direção de design

A interface busca combinar:

**minimalismo + fantasia medieval + design editorial + UI moderna.**

A prioridade visual é:

1. legibilidade;
2. organização;
3. usabilidade;
4. consistência;
5. estética.

O objetivo é evitar tanto a aparência de um formulário convencional quanto o excesso de elementos decorativos típico de algumas fichas de RPG.

---

## 🗺️ Roadmap inicial

* [x] Definição inicial do conceito
* [x] Definição da direção visual
* [ ] Primeira versão funcional da ficha
* [ ] Revisão de UX
* [ ] Revisão de responsividade
* [ ] Refatoração da arquitetura
