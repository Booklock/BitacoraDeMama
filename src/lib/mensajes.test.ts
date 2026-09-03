import { describe, expect, it } from 'vitest';
import { detalleTecnico, mensajeDeError } from './mensajes';

describe('detalleTecnico', () => {
  it('lee el mensaje de un Error normal', () => {
    expect(detalleTecnico(new Error('algo falló'))).toBe('algo falló');
  });

  it('lee los errores de PostgREST, que son objetos planos', () => {
    // Esto producía «[object Object]» y dejaba sin depurar el fallo real.
    const error = {
      code: 'PGRST202',
      message: 'Could not find the function public.create_project',
      details: null,
      hint: 'Perhaps you meant create_project_for_current_user',
    };
    const texto = detalleTecnico(error);
    expect(texto).toContain('PGRST202');
    expect(texto).toContain('Could not find the function');
    expect(texto).toContain('Perhaps you meant');
    expect(texto).not.toContain('[object Object]');
  });

  it('lee los errores de autenticación, que usan otros campos', () => {
    expect(detalleTecnico({ msg: 'Email not confirmed' })).toBe('Email not confirmed');
    expect(detalleTecnico({ error_description: 'Invalid grant' })).toBe('Invalid grant');
  });

  it('nunca devuelve [object Object]', () => {
    for (const caso of [{}, { a: 1 }, [], null, undefined, 42, { code: 'X' }]) {
      expect(detalleTecnico(caso)).not.toContain('[object Object]');
    }
  });

  it('aguanta un objeto con referencias circulares', () => {
    const circular: Record<string, unknown> = {};
    circular.yo = circular;
    expect(detalleTecnico(circular)).toBe('Error sin detalle');
  });
});

describe('mensajeDeError', () => {
  it('reconoce que falta una migración y conserva el detalle', () => {
    const texto = mensajeDeError({
      code: 'PGRST202',
      message: 'Could not find the function public.create_project',
    });
    expect(texto).toContain('migración');
    expect(texto).toContain('PGRST202');
  });

  it('reconoce la sesión no iniciada', () => {
    expect(mensajeDeError({ message: 'Se necesita sesión iniciada' })).toContain('sesión');
  });

  it('devuelve el detalle cuando no hay caso conocido, en vez de un genérico', () => {
    expect(mensajeDeError({ message: 'algo muy raro' })).toBe('algo muy raro');
  });
});
