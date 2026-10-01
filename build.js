// Uso: npm run build <slug>
// Lê clientes/<slug>/config.json + logo.svg|logo.png e gera dist/<slug>/index.html e placa-qr.svg.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { brcode, TIPOS_CHAVE } from './lib/pix.js';
import { lerHex, paleta } from './lib/cor.js';

const raiz = dirname(fileURLToPath(import.meta.url));
const CAMPOS = ['nome', 'recebedor', 'cidade', 'chave', 'tipoChave', 'corPrincipal', 'corSecundaria', 'nomeNoBanco'];

function parar(titulo, erros = []) {
  console.error(`\n${titulo}`);
  for (const e of erros) console.error(`  - ${e}`);
  console.error('');
  process.exit(1);
}

const slug = process.argv[2];
const pastaClientes = join(raiz, 'clientes');
if (!slug) {
  const existentes = existsSync(pastaClientes) ? readdirSync(pastaClientes).join(', ') : 'nenhum';
  parar(`Informe o cliente: npm run build <slug>   (clientes: ${existentes})`);
}
if (!/^[a-z0-9-]+$/.test(slug)) parar(`Slug "${slug}" inválido: use só letras minúsculas, números e hífen.`);

const pasta = join(pastaClientes, slug);
const arqConfig = `clientes/${slug}/config.json`;
if (!existsSync(join(pasta, 'config.json'))) parar(`Não achei ${arqConfig}.`);

let config;
try {
  config = JSON.parse(readFileSync(join(pasta, 'config.json'), 'utf8'));
} catch (e) {
  parar(`${arqConfig} não é um JSON válido: ${e.message}`);
}

// Validação: junta todos os problemas antes de parar.
const erros = [];
const texto = (k) => (typeof config[k] === 'string' ? config[k].trim() : '');

for (const k of Object.keys(config)) {
  if (!CAMPOS.includes(k)) erros.push(`campo desconhecido "${k}" (campos aceitos: ${CAMPOS.join(', ')})`);
}
for (const k of CAMPOS.filter((k) => k !== 'corSecundaria')) {
  if (!texto(k)) erros.push(`"${k}" é obrigatório e precisa ser texto`);
}

const recebedor = texto('recebedor');
if (recebedor.length > 25) erros.push(`"recebedor" tem ${recebedor.length} caracteres; o máximo é 25 ("${recebedor}")`);
if (recebedor && !/^[A-Z0-9 .\-]+$/.test(recebedor)) {
  erros.push(`"recebedor" deve estar em MAIÚSCULAS, sem acento (só A-Z, 0-9, espaço, ponto e hífen): "${recebedor}"`);
}
const cidade = texto('cidade');
if (cidade.length > 15) erros.push(`"cidade" tem ${cidade.length} caracteres; o máximo é 15 ("${cidade}")`);
if (cidade && !/^[A-Za-z0-9 .\-]+$/.test(cidade)) erros.push(`"cidade" não pode ter acento nem símbolos: "${cidade}"`);

const principal = lerHex(texto('corPrincipal'));
if (texto('corPrincipal') && !principal) {
  erros.push(`"corPrincipal" inválida: "${config.corPrincipal}" (use #RRGGBB, ex.: #F2C200)`);
}
let secundaria = null;
if (config.corSecundaria != null && config.corSecundaria !== '') {
  secundaria = lerHex(String(config.corSecundaria).trim());
  if (!secundaria) erros.push(`"corSecundaria" inválida: "${config.corSecundaria}" (use #RRGGBB ou deixe sem)`);
}

let chave = null;
const tipo = texto('tipoChave');
if (tipo && !TIPOS_CHAVE[tipo]) {
  erros.push(`"tipoChave" inválido: "${tipo}" (use: ${Object.keys(TIPOS_CHAVE).join(', ')})`);
} else if (tipo && texto('chave')) {
  try {
    chave = TIPOS_CHAVE[tipo](texto('chave'));
  } catch (e) {
    erros.push(`"chave" "${config.chave}" não é uma chave ${tipo} válida: ${e.message}`);
  }
}

// Logo: exatamente um entre logo.svg e logo.png.
const logos = ['logo.svg', 'logo.png'].filter((f) => existsSync(join(pasta, f)));
let logo = null;
if (logos.length === 0) erros.push(`falta a logo: coloque logo.svg ou logo.png em clientes/${slug}/`);
else if (logos.length > 1) erros.push(`há logo.svg e logo.png em clientes/${slug}/; deixe só um`);
else {
  const bytes = readFileSync(join(pasta, logos[0]));
  if (logos[0] === 'logo.svg') {
    const svg = bytes.toString('utf8');
    if (!/<svg[\s>]/.test(svg)) erros.push('logo.svg não parece ser um SVG');
    else if (/(href|src)\s*=\s*["']\s*(https?:)?\/\/|url\(\s*["']?\s*(https?:)?\/\//i.test(svg)) {
      erros.push('logo.svg carrega arquivo externo (link http); embuta tudo no SVG');
    } else logo = 'data:image/svg+xml;base64,' + bytes.toString('base64');
  } else {
    if (!bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      erros.push('logo.png não é um PNG válido');
    } else logo = 'data:image/png;base64,' + bytes.toString('base64');
  }
}

let cores = null;
if (principal) {
  try {
    cores = paleta(principal, secundaria);
  } catch (e) {
    erros.push(e.message);
  }
}

if (erros.length) parar(`Build de "${slug}" parou: corrija ${arqConfig}`, erros);

// Geração
const payload = brcode({ chave: chave.payload, recebedor, cidade: cidade.toUpperCase() });
const qrSvg = await QRCode.toString(payload, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 4,
  color: { dark: '#000000', light: '#ffffff' },
});

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const qrInline = qrSvg
  .trim()
  .replace(' xmlns="http://www.w3.org/2000/svg"', '')
  .replace('<svg ', '<svg role="img" aria-label="QR Code Pix" ');

const valores = {
  ...cores,
  nome: esc(texto('nome')),
  nomeNoBanco: esc(texto('nomeNoBanco')),
  logo,
  payload: esc(payload),
  chaveCopia: esc(chave.copia),
  chaveExibicao: esc(chave.exibicao),
  chaveRotulo: esc(chave.rotulo),
  qr: qrInline,
};
const modelo = readFileSync(join(raiz, 'lib', 'modelo.html'), 'utf8');
const html = modelo.replace(/\{\{(\w+)\}\}/g, (_, k) => {
  if (!(k in valores)) throw new Error(`modelo.html usa {{${k}}}, que não existe`);
  return valores[k];
});

const saida = join(raiz, 'dist', slug);
mkdirSync(saida, { recursive: true });
writeFileSync(join(saida, 'index.html'), html);
writeFileSync(join(saida, 'placa-qr.svg'), qrSvg);

console.log(`ok: dist/${slug}/index.html e dist/${slug}/placa-qr.svg`);
console.log(`payload: ${payload}`);
