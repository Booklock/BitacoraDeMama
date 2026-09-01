/** Traduce errores de Supabase a algo que una persona pueda accionar. */
export function mensajeDeError(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e ?? '');

  if (/secret API key|Forbidden use/i.test(texto)) {
    return (
      'La app está configurada con la llave secreta de Supabase en vez de la ' +
      'pública. Hay que revocarla y cambiarla — avísale a quien configuró el sitio.'
    );
  }
  if (/Invalid API key|apikey/i.test(texto)) {
    return 'La llave de Supabase no es válida. Revisa la configuración del sitio.';
  }
  if (/Could not find the function|PGRST202/i.test(texto)) {
    return 'Falta ejecutar una migración en la base de datos.';
  }
  if (/fetch failed|network|Failed to fetch/i.test(texto)) {
    return 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.';
  }
  return texto || 'Algo salió mal. Inténtalo de nuevo.';
}
