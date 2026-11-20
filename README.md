# Caderneta

App de controle acadêmico para Windows: notas com fórmulas de média, horário da semana, faltas e frequência, calendário com avisos, gráfico de desempenho e histórico com boletim em PDF. Cada pessoa tem uma conta com senha, e os dados ficam criptografados no próprio computador. Nada vai para a internet.

Feito com Electron 45, React 19 e Vite 7.

## Telas

| Tela | O que tem |
|---|---|
| **Início** | Saudação, aulas de hoje (a de agora e quanto falta para a próxima), média geral, matérias abaixo da média ou perto do limite de faltas, e o que vem nos próximos 7 dias. Atalhos para lançar nota, falta e lembrete. |
| **Notas** | Notas por matéria e por parte do período, fórmulas de média, bônus, média da escola e "quanto preciso" para passar. Importação por print com IA. |
| **Horário** | Grade da semana, com sala e professor. Montagem rápida em tabela. |
| **Calendário** | Provas, trabalhos, tarefas, lembretes, eventos e feriados. Eventos de vários dias, repetição semanal ou mensal e marcação de feito em cada ocorrência. |
| **Desempenho** | Gráfico de cada matéria (por avaliação ou pela média de cada parte), tendência, melhor e pior nota, versão em tabela e miniaturas de todas as matérias. |
| **Histórico** | Boletim de todos os períodos com média final, frequência e situação; lista de todas as notas com filtros. Exporta o boletim de um período ou o histórico completo em PDF. |
| **Ajustes** | Perfil, tema, casas decimais, avisos, travamento automático, PIN, senha, código de recuperação, cópia de segurança e apagar a conta. |

## Períodos

Cada período (um ano ou semestre letivo) é dividido em bimestres, trimestres, semestres, etapas, unidades ou módulos (até 24 partes). O período guarda a nota máxima, a média para passar e a frequência mínima. Dá para ter vários períodos e trocar entre eles pela barra lateral; os antigos ficam no Histórico.

## Comandos

Precisa do Node.js 20.19 ou mais novo (por causa do Vite 7).

```
npm install
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Abre o app com recarga automática (usa a pasta `%APPDATA%\Caderneta (dev)`) |
| `npm start` | Gera a interface e abre o app |
| `npm test` | Testa fórmulas, médias, "quanto preciso", horário, calendário e o cofre |
| `npm run smoke` | Abre o app de verdade numa pasta temporária, passa por todas as telas e salva capturas |
| `npm run dist` | Gera o instalador em `release\Caderneta Setup <versão>.exe` |
| `npm run icon` | Refaz `build\icon.png` |

## Onde ficam os dados

`%APPDATA%\Caderneta\contas\<id>\`

- `cofre.cad`: o arquivo da conta (nome em claro; notas, horário e eventos criptografados)
- `cofre.bak`: a versão anterior
- `copias\`: uma cópia por dia, das últimas 30 (também criptografadas)
- `acesso.json`: tentativas de senha e de PIN, e últimos acessos
- `pin.dat`: o PIN de entrada rápida, se a pessoa criou um (só abre neste computador e nesta conta do Windows; não vai nas cópias)

A posição e o tamanho da janela ficam em `%APPDATA%\Caderneta\janela.json`.

### Cópia de segurança

Em Ajustes, **Salvar cópia** gera um arquivo `.cad` (por padrão em Documentos) com a conta inteira, ainda criptografada. Na tela de entrada, **Restaurar de uma cópia** traz esse arquivo de volta em outro PC ou depois de formatar, pedindo a senha ou o código de recuperação. Se a conta já existir no computador, o app pergunta se é para substituir.

## Notas que fogem do padrão

- **Bônus**: pontos extras (ou desconto, com número negativo) somados direto na média da parte, sem passar da nota máxima. Na fórmula aparece como `BONUS`; se a fórmula citar `BONUS`, é ela que decide onde ele entra.
- **Média da escola**: a média que a escola divulgou. Quando existe, ela substitui a conta do app naquela parte (ou na média final).
- **Conta própria**: cada matéria pode ter a sua fórmula, igual para todas as partes ou diferente em cada uma (Notas → Fórmulas → Matérias com conta diferente). Também dá para tirar uma matéria da média geral.
- **Avaliação que vale menos**: uma nota pode valer, por exemplo, 2 pontos; no gráfico ela é convertida para a escala do período.

## Fórmulas

Siglas das avaliações (`P1`, `TRAB`), `MEDIA` (média das avaliações, com peso), `SOMA` (soma dos pontos), `BONUS` (soma dos bônus), códigos das etapas na média final (`T1`, `B2`, `S3`...) e as funções `max`, `min`, `media`, `soma`, `arred`, `arredmeio` e `se`. Os números aceitam vírgula, e os valores das funções se separam com `;`.

As siglas são sugeridas pelo nome da avaliação ("Prova 1" vira `P1`, "Trabalho" vira `TRAB`), mas podem ser trocadas.

## Faltas e frequência

As faltas são lançadas por matéria (botão **Falta** no Início). Com o total de aulas da matéria, o app calcula a frequência e quantas aulas ainda dá para faltar sem passar da frequência mínima do período. A matéria aparece em "Precisa de atenção" quando sobram 2 faltas ou menos.

## Importar com IA

Em Notas e em Horário, o botão **Importar** mostra um pedido pronto para colar numa IA gratuita (ChatGPT, Gemini, Copilot...) junto com os prints do boletim ou do horário. A resposta (um JSON) é colada no app, ou aberta como arquivo. Antes de gravar, o app mostra uma prévia: como cada matéria do print entra no app, o que é nota nova, o que atualiza uma nota que já existe e o que tem problema. O app não manda nada para a internet. A lógica fica em `src/lib/importar.js`.

## Horário rápido

Mudar a semana abre uma tabela com os horários nas linhas e os dias nas colunas: é só escolher a matéria de cada célula. Os horários podem ser gerados de uma vez (primeira aula, duração, quantas aulas, intervalo).

## Avisos

Os eventos do calendário podem avisar na hora, 10 ou 30 minutos antes, 1 ou 3 horas antes, 1 ou 2 dias antes ou 1 semana antes. Também dá para receber um aviso antes de cada aula (na hora, ou 5, 10 ou 15 minutos antes). Os avisos são notificações do Windows.

- **Mostrar o assunto no aviso**: desligado, a notificação só diz que há um lembrete, sem mostrar o que é.
- **Continuar avisando com a janela fechada**: ao fechar no X, a Caderneta trava a conta e fica na bandeja, perto do relógio. Para sair de vez: botão direito no ícone → Sair.
- **Testar aviso** (em Ajustes) manda uma notificação de teste.

## Segurança

- **AES-256-GCM** com uma chave aleatória por conta. Essa chave fica guardada duas vezes: uma trancada pela senha e outra pelo código de recuperação, as duas passando pelo scrypt (N=2^17). A senha nunca é gravada.
- **Código de recuperação**: aparece uma vez ao criar a conta. Dá para gerar um novo em Ajustes (o antigo para de funcionar). Ao copiar o código, ele sai da área de transferência depois de 90 segundos.
- **PIN**: opcional, de 6 a 12 números, para entrar rápido. A chave fica embrulhada pelo PIN (scrypt) e o arquivo ainda é trancado pela conta do Windows (DPAPI, via `safeStorage`). 5 PINs errados apagam o PIN; a cada 30 dias sem usar a senha, ela é pedida de novo.
- **Tentativas erradas**: depois de 5 senhas erradas, o app faz uma pausa de 30 s, que dobra a cada novo erro (até 15 min). Só uma tentativa é processada por vez. Na entrada, o app avisa quantas tentativas erradas houve desde o último acesso.
- **Travamento**: o app trava sozinho depois de um tempo parado (1 a 60 min, ou nunca), quando o Windows trava (Win+L), quando o PC dorme ou ao apertar **Ctrl+L**. Ao travar, a chave é apagada da memória e a tela é recarregada, então nada do que estava aberto fica na memória da página.
- **Esconder de capturas de tela**: opcional; prints, gravações e compartilhamento de tela mostram a janela preta.
- **Apagar a conta**: pede a senha e a palavra `APAGAR`. Não tem volta.
- **Electron** com `contextIsolation`, `sandbox` e CSP. A página não acessa Node nem a chave, só os canais do `preload.js`, e o processo principal só responde a chamadas vindas da própria página. Navegação, janelas novas, `webview` e todas as permissões (câmera, microfone etc.) são bloqueadas. Uma instância por vez.
- **Fórmulas** são interpretadas pelo próprio app, sem `eval`.

## Estrutura

```
main.js          processo principal: janela, bandeja, avisos, PDF, canais IPC
preload.js       ponte entre a página e o main (window.caderneta)
vault.js         contas, criptografia, cópias, PIN e tentativas
src/
  App.jsx        sessão, salvamento, travamento e navegação
  views/         telas e janelas (Início, Notas, Horário, Calendário...)
  components/    interface comum e o gráfico de linhas
  lib/           regras sem interface: fórmulas, médias, horário, eventos,
                 importação, boletim em PDF, força da senha
scripts/         dev, testes, smoke test e geração do ícone
build/           ícone do instalador
```
