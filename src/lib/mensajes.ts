/** Traduce errores de Supabase a algo que una persona pueda accionar. */
export function mensajeDeError(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e ?? '');

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
  if (/Could not find the function|PGRST202/i.test(texto)) {
    return (
      'Falta ejecutar una migración en la base de datos: la función que hace ' +
      'falta no existe todavía. Hay que correr supabase/instalacion-completa.sql.'
    );
  }
  if (/Se necesita sesión iniciada/i.test(texto)) {
    return (
      'Tu sesión no llegó a iniciarse. Suele pasar cuando Supabase pide ' +
      'confirmar el correo: confírmalo y vuelve a entrar.'
    );
  }
  if (/fetch failed|network|Failed to fetch/i.test(texto)) {
    return 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.';
  }
  return texto || 'Algo salió mal. Inténtalo de nuevo.';
}
