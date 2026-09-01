import { describe, expect, it } from 'vitest';
import { esLlaveSecreta, normalizarUrl } from './env';

describe('normalizarUrl', () => {
  it('quita la barra final que provoca PGRST125', () => {
    expect(normalizarUrl('https://abc.supabase.co/')).toBe('https://abc.supabase.co');
  });

  it('quita varias barras', () => {
    expect(normalizarUrl('https://abc.supabase.co///')).toBe('https://abc.supabase.co');
  });

  it('quita espacios y saltos de línea al copiar y pegar', () => {
    expect(normalizarUrl('  https://abc.supabase.co/ \n')).toBe('https://abc.supabase.co');
  });

  it('deja intacta una URL correcta', () => {
    expect(normalizarUrl('https://abc.supabase.co')).toBe('https://abc.supabase.co');
  });
});

describe('esLlaveSecreta', () => {
  // Payload {"role":"service_role"} en base64url.
  const payloadServicio = Buffer.from('{"role":"service_role"}').toString('base64url');
  const payloadAnon = Buffer.from('{"role":"anon"}').toString('base64url');

  it('detecta el formato nuevo sb_secret_', () => {
    expect(esLlaveSecreta('sb_secret_abc123')).toBe(true);
  });

  it('detecta el JWT antiguo de service_role', () => {
    expect(esLlaveSecreta(`cabecera.${payloadServicio}.firma`)).toBe(true);
  });

  it('acepta la llave pública en formato JWT', () => {
    expect(esLlaveSecreta(`cabecera.${payloadAnon}.firma`)).toBe(false);
  });

  it('acepta el formato nuevo publishable', () => {
    expect(esLlaveSecreta('sb_publishable_abc123')).toBe(false);
  });

  it('no revienta con un texto que no es una llave', () => {
    expect(esLlaveSecreta('cualquier.cosa.rara')).toBe(false);
    expect(esLlaveSecreta('')).toBe(false);
  });
});
