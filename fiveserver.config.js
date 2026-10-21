// Configuração compartilhada pela extensão Five Server do VS Code.
module.exports = {
  host: '127.0.0.1',
  port: 5500,
  // A extensão combina root com a pasta do workspace; use um caminho relativo.
  root: '.',
  open: 'index.html',
  // A aplicação administra seu DOM e a troca segura de versões offline.
  injectBody: false,
  navigate: false,
};
