// Cores em [r, g, b] de 0 a 255. Contraste conforme WCAG 2.

export function lerHex(texto) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(texto);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// mistura: t = 0 devolve a, t = 1 devolve b
export const misturar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function luminancia(c) {
  const [r, g, b] = c.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// Escurece a cor aos poucos até atingir o contraste mínimo sobre o fundo.
export function escurecerAte(cor, fundo, minimo) {
  for (let t = 0; t <= 1; t += 0.02) {
    const c = misturar(cor, [0, 0, 0], t).map(Math.round);
    if (contraste(c, fundo) >= minimo) return c;
  }
  return [0, 0, 0];
}

const BRANCO = [255, 255, 255];
const PRETO = [0, 0, 0];

// Paleta da página: neutros levemente puxados para o tom da marca.
export function paleta(principal, secundaria) {
  const fundo = misturar([250, 250, 249], principal, 0.05).map(Math.round);
  const papel = BRANCO;
  const linha = misturar([224, 224, 221], principal, 0.12).map(Math.round);
  const texto = escurecerAte(misturar([24, 24, 24], principal, 0.1).map(Math.round), fundo, 12);
  const suave = escurecerAte(misturar([88, 88, 86], principal, 0.12).map(Math.round), fundo, 4.5);

  // Texto do botão: o que tiver mais contraste entre branco e o texto da página (ou preto puro).
  const opcoes = [BRANCO, texto, PRETO].sort((a, b) => contraste(b, principal) - contraste(a, principal));
  const textoBotao = opcoes[0];

  // O "detalhe" (o "Copiar" da chave) e o botão no estado copiado usam a cor da marca
  // escurecida só o necessário para ser legível sobre o fundo.
  const tinta = escurecerAte(principal, fundo, 4.5);
  const detalhe = escurecerAte(secundaria ?? principal, fundo, 4.5);
  // Marca muito clara (ex.: branco): a borda do botão usa a versão escurecida para o botão não sumir.
  const borda = contraste(principal, fundo) >= 1.4 ? principal : tinta;

  const p = { fundo, papel, linha, texto, suave, principal, borda, textoBotao, tinta, detalhe };
  const pares = [
    ['texto', texto, fundo], ['texto (papel)', texto, papel], ['suave', suave, fundo],
    ['botão', textoBotao, principal], ['copiado', tinta, papel], ['detalhe', detalhe, fundo],
  ];
  for (const [nome, a, b] of pares) {
    const r = contraste(a, b);
    if (r < 4.5) throw new Error(`contraste de ${nome} ficou em ${r.toFixed(2)}:1 (mínimo 4,5:1)`);
  }
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, hex(v)]));
}
