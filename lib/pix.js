// BR Code estático (Manual de Padrões para Iniciação do Pix, Banco Central)
// e validação/formatação das chaves Pix.

const campo = (id, valor) => {
  if (valor.length > 99) throw new Error(`campo ${id} passa de 99 caracteres`);
  return id + String(valor.length).padStart(2, '0') + valor;
};

export function crc16(texto) {
  let crc = 0xffff;
  for (const byte of Buffer.from(texto, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Exemplo do manual do BC: se não bater, o CRC está errado.
const EXEMPLO_BC = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
if (crc16(EXEMPLO_BC) !== '1D3D') throw new Error('CRC16 não confere com o exemplo do manual do BC');

export function brcode({ chave, recebedor, cidade }) {
  const semCrc =
    campo('00', '01') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave)) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('58', 'BR') +
    campo('59', recebedor) +
    campo('60', cidade) +
    campo('62', campo('05', '***')) +
    '6304';
  return semCrc + crc16(semCrc);
}

function dvCpf(base) {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

// Vale para o CNPJ numérico e para o alfanumérico (valor do caractere = código ASCII - 48).
function dvCnpj(base) {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += (base.charCodeAt(i) - 48) * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

// Cada tipo devolve: payload (vai no BR Code), copia (o que o toque copia),
// exibicao (texto na página) e rotulo. Lança Error com mensagem para o usuário.
export const TIPOS_CHAVE = {
  cpf(bruta) {
    const d = bruta.replace(/[.\-\s]/g, '');
    if (!/^\d{11}$/.test(d)) throw new Error('CPF precisa ter 11 dígitos');
    if (/^(\d)\1+$/.test(d) || dvCpf(d.slice(0, 9)) !== Number(d[9]) || dvCpf(d.slice(0, 10)) !== Number(d[10])) {
      throw new Error('CPF com dígito verificador inválido');
    }
    return {
      payload: d,
      copia: d,
      exibicao: `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`,
      rotulo: 'Chave CPF',
    };
  },
  cnpj(bruta) {
    const c = bruta.replace(/[.\-/\s]/g, '').toUpperCase();
    if (!/^[0-9A-Z]{12}\d{2}$/.test(c)) throw new Error('CNPJ precisa ter 14 caracteres (12 letras/números + 2 dígitos)');
    if (/^(\d)\1+$/.test(c) || dvCnpj(c.slice(0, 12)) !== Number(c[12]) || dvCnpj(c.slice(0, 13)) !== Number(c[13])) {
      throw new Error('CNPJ com dígito verificador inválido');
    }
    return {
      payload: c,
      copia: c,
      exibicao: `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`,
      rotulo: 'Chave CNPJ',
    };
  },
  celular(bruta) {
    if (/[^\d\s()+\-.]/.test(bruta)) throw new Error('celular só pode ter números, espaço, (, ), + e -');
    let d = bruta.replace(/\D/g, '');
    if (d.length === 13 && d.startsWith('55')) d = d.slice(2);
    if (!/^[1-9]{2}9\d{8}$/.test(d)) throw new Error('celular precisa ser DDD + 9 dígitos começando com 9, ex.: (17) 99102-8063');
    return {
      payload: '+55' + d,
      copia: d,
      exibicao: `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`,
      rotulo: 'Chave celular',
    };
  },
  email(bruta) {
    const e = bruta.trim().toLowerCase();
    if (e.length > 77 || !/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(e)) {
      throw new Error('e-mail inválido (ou com mais de 77 caracteres)');
    }
    return { payload: e, copia: e, exibicao: e, rotulo: 'Chave e-mail' };
  },
  aleatoria(bruta) {
    const a = bruta.trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a)) {
      throw new Error('chave aleatória precisa ter o formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    }
    return { payload: a, copia: a, exibicao: a, rotulo: 'Chave aleatória' };
  },
};
