/**
 * Extrae un texto legible de cualquier cosa que se haya lanzado.
 *
 * Los errores de Supabase NO son instancias de Error: `.rpc()` y `.from()`
 * devuelven objetos planos `{ message, details, hint, code }`, y los de
 * autenticación traen `msg` o `error_description`. Pasar eso por String()
 * produce «[object Object]», que es exactamente lo que no se puede depurar.
 */
export function detalleTecnico(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;

  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

    const partes = [
      texto(o.code),
      texto(o.message) ?? texto(o.msg) ?? texto(o.error_description) ?? texto(o.error),
      texto(o.details),
      texto(o.hint),
    ].filter((v): v is string => v !== null);

    if (partes.length > 0) return partes.join(' · ');

    try {
      const json = JSON.stringify(e);
      if (json && json !== '{}') return json;
    } catch {
      // Objeto con referencias circulares: se cae al genérico de abajo.
    }
  }

  return 'Error sin detalle';
}

/** Traduce errores de Supabase a algo que una persona pueda accionar. */
export function mensajeDeError(e: unknown): string {
  const texto = detalleTecnico(e);

  if (/secret API key|Forbidden use|es la SECRETA/i.test(texto)) {
    return (
      'El sitio está configurado con la llave secreta de Supabase en vez de la ' +
      'pública. No es algo que puedas resolver desde aquí: hay que revocar esa ' +
      'llave y cambiarla en la configuración del sitio.'
    );
  }
  if (/Falta la variable de entorno/i.test(texto)) {
    return 'El sitio todavía no está conectado a su base de datos.';
  }
  if (/Invalid API key|apikey/i.test(texto)) {
    return 'La llave de Supabase no es válida. Revisa la configuración del sitio.';
  }
  if (/Could not find the function|PGRST202|does not exist/i.test(texto)) {
    return (
      'Falta ejecutar una migración en la base de datos: lo que la app necesita ' +
      `todavía no existe ahí. Hay que correr supabase/instalacion-completa.sql. (${texto})`
    );
  }
  if (/Se necesita sesión iniciada|JWT|not authenticated/i.test(texto)) {
    return (
      'Tu sesión no llegó a iniciarse. Suele pasar cuando Supabase pide ' +
      'confirmar el correo: confírmalo y vuelve a entrar.'
    );
  }
  if (/row-level security|violates row-level/i.test(texto)) {
    return `La base rechazó la operación por seguridad. (${texto})`;
  }
  if (/fetch failed|network|Failed to fetch|NetworkError/i.test(texto)) {
    return 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.';
  }

  // Sin caso conocido, se muestra el detalle tal cual: es más útil que un
  // «algo salió mal» que no permite ni preguntar.
  return texto;
}
