// lib/validacao.test.ts
import { describe, it, expect } from 'vitest';
import { ErroValidacao, lerJson, texto, dataIso, urlHttps, respostaErro } from './validacao';

describe('validacao', () => {
  it('lerJson rejeita JSON invalido, nao-objeto e corpo grande', async () => {
    await expect(lerJson(new Request('http://x', { method: 'POST', body: '{' }))).rejects.toThrow(ErroValidacao);
    await expect(lerJson(new Request('http://x', { method: 'POST', body: '[1]' }))).rejects.toThrow(ErroValidacao);
    await expect(
      lerJson(new Request('http://x', { method: 'POST', body: '{}', headers: { 'content-length': '999999' } }))
    ).rejects.toThrow('grandes demais');
  });

  it('texto rejeita tipo errado, vazio obrigatorio e excesso', () => {
    expect(() => texto(123, 'campo', 10)).toThrow(ErroValidacao);
    expect(() => texto('  ', 'campo', 10, { obrigatorio: true })).toThrow('Preencha o campo');
    expect(() => texto('a'.repeat(11), 'campo', 10)).toThrow('muito longo');
    expect(texto(undefined, 'campo', 10)).toBe('');
  });

  it('texto remove codigo HTML/script colado no campo', () => {
    expect(texto('<script>alert(1)</script> Obrigado!', 'campo', 100)).toBe('alert(1) Obrigado!');
    expect(texto('Ana <b>e</b> Bruno', 'campo', 100)).toBe('Ana e Bruno');
    expect(texto('Ana & Bruno', 'campo', 100)).toBe('Ana & Bruno');
  });

  it('dataIso valida formato e existencia', () => {
    expect(dataIso('2027-01-01', 'data')).toBe('2027-01-01');
    expect(() => dataIso('2027-13-40', 'data')).toThrow(ErroValidacao);
    expect(() => dataIso('amanha', 'data')).toThrow(ErroValidacao);
  });

  it('urlHttps aceita so https', () => {
    expect(urlHttps('https://a.com/x.jpg', 'imagem')).toBe('https://a.com/x.jpg');
    expect(() => urlHttps('http://a.com/x.jpg', 'imagem')).toThrow(ErroValidacao);
    expect(() => urlHttps('javascript:alert(1)', 'imagem')).toThrow(ErroValidacao);
  });

  it('respostaErro nao vaza mensagem de erro inesperado', async () => {
    const r = respostaErro(new TypeError('Cannot read properties of undefined'));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ erro: 'Algo deu errado. Tente novamente em instantes.' });
  });
});
