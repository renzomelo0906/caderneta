# Caderneta

App de controle acadêmico para Windows: notas com fórmulas de média, horário da semana, calendário com avisos, gráfico de desempenho e histórico. Cada pessoa tem uma conta com senha, e os dados ficam criptografados no próprio computador.

## Comandos

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

## Notas que fogem do padrão

- **Bônus:** pontos extras (ou desconto, com número negativo) somados direto na média da parte, sem passar da nota máxima. Na fórmula aparece como `BONUS`; se a fórmula citar `BONUS`, é ela que decide onde ele entra.
- **Média da escola:** a média que a escola divulgou. Quando existe, ela substitui a conta do app naquela parte (ou na média final).
- **Conta própria:** cada matéria pode ter a sua fórmula, igual para todas as partes ou diferente em cada uma (Notas → Fórmulas → Matérias com conta diferente). Também dá para tirar uma matéria da média geral.

## Importar com IA

Em Notas e em Horário, o botão **Importar** mostra um pedido pronto para colar numa IA gratuita (ChatGPT, Gemini, Copilot...) junto com os prints do boletim ou do horário. A resposta (um JSON) é colada no app, ou aberta como arquivo. Antes de gravar, o app mostra uma prévia: como cada matéria do print entra no app, o que é nota nova, o que atualiza uma nota que já existe e o que tem problema. O app não manda nada para a internet. A lógica fica em `src/lib/importar.js`.

## Horário rápido

**Mudar a semana** abre uma tabela com os horários nas linhas e os dias nas colunas: é só escolher a matéria de cada célula. Os horários podem ser gerados de uma vez (primeira aula, duração, quantas aulas, intervalo).

## Segurança

- AES-256-GCM com uma chave aleatória por conta. Essa chave fica guardada duas vezes: uma trancada pela senha e outra pelo código de recuperação, as duas passando pelo scrypt (N=2^17). A senha nunca é gravada.
- **PIN:** opcional, de 6 a 12 números, para entrar rápido. A chave fica embrulhada pelo PIN (scrypt) e o arquivo ainda é trancado pela conta do Windows (DPAPI, via `safeStorage`). 5 PINs errados apagam o PIN; a cada 30 dias sem usar a senha, ela é pedida de novo.
- Depois de 5 senhas erradas, o app faz uma pausa de 30 s, que dobra a cada novo erro (até 15 min). Na entrada, o app avisa quantas tentativas erradas houve desde o último acesso.
- O app trava sozinho depois de um tempo parado, quando o Windows trava (Win+L) ou quando o PC dorme. Ao travar, a tela é recarregada e nada do que estava aberto fica na memória da página.
- Electron com `contextIsolation`, `sandbox` e CSP. A página não acessa Node nem a chave, só os canais do `preload.js`. As fórmulas são interpretadas pelo próprio app, sem `eval`.

## Fórmulas

Siglas das avaliações (`P1`, `TRAB`), `MEDIA` (média das avaliações, com peso), `SOMA` (soma dos pontos), `BONUS` (soma dos bônus), códigos das etapas na média final (`T1`, `B2`, `S3`...) e as funções `max`, `min`, `media`, `soma`, `arred`, `arredmeio` e `se`. Os números aceitam vírgula, e os valores das funções se separam com `;`.
