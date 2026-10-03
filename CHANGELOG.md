# Histórico de versões

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
