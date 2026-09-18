// models/pix.test.ts
import { describe, it, expect } from 'vitest';
import { gerarPixCopiaCola, calcularCRC16, normalizarTextoPix } from './pix';

describe('calcularCRC16', () => {
  it('calcula o CRC16-CCITT de uma string conhecida', () => {
    // Valor de referencia validado manualmente com a especificacao do Banco Central
    expect(calcularCRC16('123456789')).toBe('29B1');
  });
});

describe('gerarPixCopiaCola', () => {
  it('gera uma string terminando com o campo CRC (6304 + 4 hex chars)', () => {
    const codigo = gerarPixCopiaCola({
      chave: 'convidado@exemplo.com',
      nomeRecebedor: 'FULANO DA SILVA',
      cidade: 'SAO PAULO',
      valor: 150.5,
      identificador: 'PEDIDO001',
    });

    expect(codigo.startsWith('000201')).toBe(true);
    expect(codigo).toMatch(/6304[0-9A-F]{4}$/);
  });

  it('inclui o valor formatado com duas casas decimais', () => {
    const codigo = gerarPixCopiaCola({
      chave: 'chave-pix',
      nomeRecebedor: 'FULANO',
      cidade: 'SAO PAULO',
      valor: 99,
      identificador: 'X',
    });
    expect(codigo).toContain('540599.00');
  });

  it('trunca nome e cidade para os limites do padrao (25 e 15 caracteres)', () => {
    const codigo = gerarPixCopiaCola({
      chave: 'chave-pix',
      nomeRecebedor: 'NOME MUITO MUITO MUITO LONGO DEMAIS',
      cidade: 'CIDADE COM NOME MUITO LONGO',
      valor: 10,
      identificador: 'X',
    });
    // campo 59 (nome) com tamanho maximo 25, campo 60 (cidade) com tamanho maximo 15
    expect(codigo).toContain('5925NOME MUITO MUITO MUITO');
    expect(codigo).toContain('6015CIDADE COM NOME');
  });

  it('normaliza nome e cidade com acentos, removendo diacriticos e colocando em maiusculas', () => {
    const codigo = gerarPixCopiaCola({
      chave: 'chave-pix',
      nomeRecebedor: 'José António',
      cidade: 'São Paulo',
      valor: 10,
      identificador: 'X',
    });

    // campo 59 (nome) deve conter "JOSE ANTONIO" (12 caracteres), sem acentos
    expect(codigo).toContain('5912JOSE ANTONIO');
    // campo 60 (cidade) deve conter "SAO PAULO" (9 caracteres), sem acentos
    expect(codigo).toContain('6009SAO PAULO');
  });

  it('usa *** como identificador quando ele fica vazio apos normalizar', () => {
    const codigo = gerarPixCopiaCola({
      chave: 'chave-pix',
      nomeRecebedor: 'FULANO',
      cidade: 'SAO PAULO',
      valor: 10,
      identificador: '',
    });
    expect(codigo).toContain('0503***');
  });
});

describe('normalizarTextoPix', () => {
  it('remove diacriticos e converte para maiusculas', () => {
    expect(normalizarTextoPix('José António')).toBe('JOSE ANTONIO');
    expect(normalizarTextoPix('São Paulo')).toBe('SAO PAULO');
    expect(normalizarTextoPix('Não-me-toque')).toBe('NAO-ME-TOQUE');
  });

  it('nao altera texto ja ascii e maiusculo', () => {
    expect(normalizarTextoPix('FULANO DA SILVA')).toBe('FULANO DA SILVA');
  });
});
