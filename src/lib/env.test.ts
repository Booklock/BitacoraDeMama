import { describe, expect, it } from 'vitest';
import { normalizarUrl } from './env';

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
