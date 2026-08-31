/** Lectura de variables de entorno con un mensaje claro si falta alguna. */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. ` +
        `Copia .env.example a .env.local (o cárgala en Netlify) — ver docs/05-despliegue.md.`,
    );
  }
  return value;
}

/**
 * Normaliza la URL del proyecto. Al copiarla desde el panel de Supabase es
 * fácil que se cuele una barra final o un espacio; con la barra, el cliente
 * arma rutas con doble barra y PostgREST responde PGRST125 ("Invalid path
 * specified in request URL"). Se limpia aquí en vez de exigir que la variable
 * venga perfecta.
 */
export function normalizarUrl(valor: string): string {
  return valor.trim().replace(/\/+$/, '');
}

export const supabaseUrl = () =>
  normalizarUrl(required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL));

/** La llave también se recorta: un salto de línea al pegarla la invalida. */
export const supabaseAnonKey = () =>
  required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).trim();

/** true cuando la app tiene Supabase configurado. Permite que la portada
 *  funcione en un despliegue recién creado, antes de conectar la base. */
export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
