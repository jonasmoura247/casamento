// models/pix.ts
import QRCode from 'qrcode';

function campo(id: string, valor: string): string {
  const tamanho = String(valor.length).padStart(2, '0');
  return `${id}${tamanho}${valor}`;
}

const DIACRITICOS = /[̀-ͯ]/g;

/**
 * Normaliza texto para uso em campos EMV/Pix (nomeRecebedor, cidade, identificador).
 *
 * Os campos do BR Code sao convencionalmente ASCII-only e o comprimento declarado
 * no TLV precisa corresponder ao numero de bytes do valor. Como `campo()` mede
 * `.length` (unidades UTF-16), qualquer caractere acentuado (ex.: "São Paulo",
 * "José") produziria um payload com o tamanho declarado incorreto para um parser
 * EMV estrito. Por isso removemos diacriticos e forcamos maiusculas antes de
 * qualquer truncamento, garantindo que o texto final seja ASCII puro.
 */
export function normalizarTextoPix(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toUpperCase();
}

export function calcularCRC16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function gerarPixCopiaCola(dados: {
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  valor: number;
  identificador: string;
}): string {
  const nome = normalizarTextoPix(dados.nomeRecebedor).trim().slice(0, 25);
  const cidade = normalizarTextoPix(dados.cidade).trim().slice(0, 15);
  const identificador =
    normalizarTextoPix(dados.identificador).trim().slice(0, 25) || '***';

  const merchantAccountInfo =
    campo('00', 'br.gov.bcb.pix') + campo('01', dados.chave);

  const partesSemCrc =
    campo('00', '01') + // Payload Format Indicator
    campo('26', merchantAccountInfo) + // Merchant Account Information (Pix)
    campo('52', '0000') + // Merchant Category Code
    campo('53', '986') + // Transaction Currency (BRL)
    campo('54', dados.valor.toFixed(2)) + // Transaction Amount
    campo('58', 'BR') + // Country Code
    campo('59', nome) + // Merchant Name
    campo('60', cidade) + // Merchant City
    campo('62', campo('05', identificador)); // Additional Data Field (txid)

  const payloadParaCrc = `${partesSemCrc}6304`;
  const crc = calcularCRC16(payloadParaCrc);

  return `${payloadParaCrc}${crc}`;
}

export async function gerarQrCodeDataUrl(copiaCola: string): Promise<string> {
  return QRCode.toDataURL(copiaCola, { margin: 1, width: 300 });
}
