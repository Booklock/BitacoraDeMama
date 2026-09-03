import { describe, expect, it } from 'vitest';
import { analizarLlave, esLlaveSecreta, normalizarUrl } from './env';

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

  it('quita el endpoint REST, que es el que se copia por error', () => {
    expect(normalizarUrl('https://abc.supabase.co/rest/v1/')).toBe('https://abc.supabase.co');
    expect(normalizarUrl('https://abc.supabase.co/rest/v1')).toBe('https://abc.supabase.co');
  });

  it('quita también los otros endpoints de la API', () => {
    expect(normalizarUrl('https://abc.supabase.co/auth/v1')).toBe('https://abc.supabase.co');
    expect(normalizarUrl('https://abc.supabase.co/storage/v1/')).toBe('https://abc.supabase.co');
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


describe('analizarLlave · explica qué detectó', () => {
  const payloadServicio = Buffer.from('{"role":"service_role"}').toString('base64url');
  const payloadAnon = Buffer.from('{"role":"anon"}').toString('base64url');

  it('nombra el prefijo cuando es una llave secreta nueva', () => {
    const r = analizarLlave('sb_secret_abc');
    expect(r.secreta).toBe(true);
    expect(r.secreta && r.motivo).toContain('sb_secret_');
  });

  it('nombra el rol cuando es un JWT de servicio', () => {
    const r = analizarLlave(`a.${payloadServicio}.b`);
    expect(r.secreta).toBe(true);
    expect(r.secreta && r.motivo).toContain('service_role');
  });

  it('reconoce los dos formatos válidos de llave pública', () => {
    expect(analizarLlave('sb_publishable_abc')).toEqual({ secreta: false, formato: 'publishable' });
    expect(analizarLlave(`a.${payloadAnon}.b`)).toEqual({ secreta: false, formato: 'jwt-anon' });
  });

  it('ante algo irreconocible no acusa de secreta', () => {
    expect(analizarLlave('texto-cualquiera').secreta).toBe(false);
  });
});
