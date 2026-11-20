// forca da senha
const COMUNS = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234', '11223344',
  'password', 'password1', 'senha123', 'senha1234', 'senhasenha', 'qwertyui', 'qwerty123', 'abcd1234',
  'abc12345', 'iloveyou', 'brasil123', 'flamengo', 'corinthians', 'palmeiras', 'saopaulo', 'vasco123',
  'escola123', 'mudar123', 'admin123', 'aaaaaaaa', 'asdfghjk', 'minhasenha', 'caderneta', '123mudar',
]);

export const SENHA_MINIMA = 8;

// 0 a 4
export function forcaSenha(senha, nome = '') {
  const s = String(senha || '');
  if (!s) return { nivel: 0, texto: '', dica: '' };
  if (s.length < SENHA_MINIMA) return { nivel: 0, texto: 'Curta demais', dica: `Use pelo menos ${SENHA_MINIMA} caracteres.` };
  const low = s.toLowerCase();
  if (COMUNS.has(low) || /^(.)\1+$/.test(s) || /^(0123456789|1234567890|abcdefgh)/.test(low)) {
    return { nivel: 0, texto: 'Muito fácil de adivinhar', dica: 'Essa senha está entre as mais usadas. Escolha outra.' };
  }
  const n = String(nome || '').trim().toLowerCase();
  if (n.length >= 3 && low.includes(n)) return { nivel: 1, texto: 'Fraca', dica: 'Evite usar seu nome na senha.' };

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length;
  let pontos = 0;
  if (s.length >= 10) pontos++;
  if (s.length >= 14) pontos++;
  if (classes >= 2) pontos++;
  if (classes >= 3) pontos++;
  if (/(.)\1\1/.test(s)) pontos--;
  const nivel = Math.max(1, Math.min(4, pontos));
  const texto = ['', 'Fraca', 'Razoável', 'Boa', 'Ótima'][nivel];
  const dica = nivel >= 3 ? '' : s.length < 12 ? 'Uma frase curta fica forte e fácil de lembrar, como "minha prova de quimica".' : 'Misture letras, números e símbolos.';
  return { nivel, texto, dica };
}

export function erroSenha(senha, confirmar, nome) {
  const f = forcaSenha(senha, nome);
  if (String(senha || '').length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (f.nivel === 0) return f.dica;
  if (confirmar !== undefined && senha !== confirmar) return 'As duas senhas estão diferentes.';
  return null;
}

const PINS_FACEIS = new Set(['123123', '121212', '112233', '123321', '654321', '696969', '159753', '147258', '789456', '102030', '010203', '131313', '202020', '252525']);
export function erroPin(pin, conf) {
  if (!/^\d+$/.test(pin)) return 'O PIN tem só números.';
  if (pin.length < 6) return 'O PIN precisa ter pelo menos 6 números.';
  if (pin.length > 12) return 'O PIN pode ter no máximo 12 números.';
  const seq = '01234567890123456789';
  const inv = '98765432109876543210';
  if (/^(\d)\1+$/.test(pin) || seq.includes(pin) || inv.includes(pin) || PINS_FACEIS.has(pin) || /^(\d\d)\1+$/.test(pin) || /^(\d{3})\1+$/.test(pin)) return 'Esse PIN é fácil de adivinhar. Escolha outro, sem sequência nem repetição.';
  if (/^(19|20)\d{2}$/.test(pin.slice(-4)) && pin.length === 8) return 'Parece uma data (aniversário é fácil de adivinhar). Escolha outro.';
  if (conf !== undefined && pin !== conf) return 'Os dois PINs não são iguais.';
  return null;
}
