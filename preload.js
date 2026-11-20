const { contextBridge, ipcRenderer } = require('electron');

const call = (canal) => (...args) => ipcRenderer.invoke(canal, ...args);

contextBridge.exposeInMainWorld('caderneta', {
  listarContas: call('contas:listar'),
  criarConta: call('contas:criar'),
  entrar: call('contas:entrar'),
  entrarPin: call('contas:entrarPin'),
  recuperar: call('contas:recuperar'),
  travar: call('contas:travar'),
  importarEscolher: call('contas:importarEscolher'),
  importarConcluir: call('contas:importarConcluir'),

  salvar: call('dados:salvar'),
  trocarSenha: call('conta:trocarSenha'),
  novoCodigo: call('conta:novoCodigo'),
  apagarConta: call('conta:apagar'),
  historicoAcessos: call('conta:historico'),
  pinStatus: call('conta:pinStatus'),
  pinDefinir: call('conta:pinDefinir'),
  pinRemover: call('conta:pinRemover'),
  exportarConta: call('conta:exportar'),

  copiar: call('app:copiar'),
  salvarTexto: call('app:salvarTexto'),
  exportarPdf: call('export:pdf'),
  abrirPasta: call('app:abrirPasta'),
  info: call('app:info'),

  tema: call('ui:tema'),
  protegerCaptura: call('ui:protegerCaptura'),
  segundoPlano: call('ui:segundoPlano'),

  agendarAvisos: call('avisos:agenda'),
  testarAviso: call('avisos:testar'),
});
