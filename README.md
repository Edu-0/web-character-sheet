# RPG Character Sheet

> Uma ficha de personagem web moderna, modular e extensível para RPGs de mesa.

## 🚧 Status

**Em desenvolvimento — protótipo inicial**

Este projeto está atualmente na fase de experimentação e prototipagem.

A primeira versão está sendo desenvolvida como uma **ficha de personagem web baseada em HTML, CSS e JavaScript**, inicialmente inspirada na estrutura de D&D 5e 2024.

O objetivo inicial não é criar apenas uma ficha estática, mas experimentar uma arquitetura que possa futuramente evoluir para uma **engine/framework genérica de fichas de RPG**.

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

## 🧩 Visão futura

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

No futuro, a definição de um sistema poderá ser representada por arquivos de configuração, possivelmente em JSON:

```text
systems/
├── dnd2024.json
├── custom-rpg.json
└── outro-sistema.json
```

Isso permitiria utilizar a mesma engine para diferentes sistemas sem precisar reconstruir a aplicação inteira.

Essa arquitetura ainda **não está implementada** e faz parte da direção futura do projeto.

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