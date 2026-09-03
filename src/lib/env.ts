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
 * Normaliza la URL del proyecto.
 *
 * En el panel de Supabase conviven la Project URL y los endpoints de la API
 * (`.../rest/v1/`, `.../auth/v1/`), y es fácil copiar el que no toca. El
 * cliente añade esas rutas por su cuenta, así que si vienen ya en la variable
 * quedan duplicadas y PostgREST responde PGRST125 ("Invalid path specified in
 * request URL"). Lo mismo pasa con una barra final o un espacio al pegar.
 *
 * Una Project URL nunca lleva ruta, así que recortarla aquí es seguro y evita
 * un error que sólo se ve en producción.
 */
export function normalizarUrl(valor: string): string {
  return valor
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(rest|auth|storage|realtime|functions)\/v\d+$/i, '')
    .replace(/\/+$/, '');
}

function decodificarBase64(texto: string): string {
  const normalizado = texto.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') return atob(normalizado);
  return Buffer.from(normalizado, 'base64').toString('utf8');
}

/**
 * ¿Es una llave secreta? Detecta tanto el formato nuevo (`sb_secret_…`) como
 * el JWT antiguo de `service_role`.
 *
 * Importa porque una variable `NEXT_PUBLIC_` se empaqueta dentro del
 * JavaScript que se sirve al navegador: poner ahí la llave secreta la publica
 * a cualquiera que abra el código fuente, y esa llave se salta Row Level
 * Security por completo. Preferimos que la app falle con un mensaje claro
 * antes que arrancar con la llave equivocada.
 */
export function esLlaveSecreta(llave: string): boolean {
  const limpia = llave.trim();
  if (limpia.startsWith('sb_secret_')) return true;

  const partes = limpia.split('.');
  if (partes.length !== 3) return false;
  try {
    return /"role"\s*:\s*"service_role"/.test(decodificarBase64(partes[1]));
  } catch {
    return false;
  }
}

export const supabaseUrl = () =>
  normalizarUrl(required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL));

/** La llave también se recorta: un salto de línea al pegarla la invalida. */
export const supabaseAnonKey = () => {
  const llave = required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ).trim();

  if (esLlaveSecreta(llave)) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY contiene una llave SECRETA (service_role). ' +
        'Esa llave se salta la seguridad por filas y, al ir en una variable ' +
        'NEXT_PUBLIC_, queda publicada en el navegador. Revócala en Supabase y ' +
        'usa la llave pública (anon / publishable). Ver docs/05-despliegue.md.',
    );
  }

  return llave;
};

/** true cuando la app tiene Supabase configurado. Permite que la portada
 *  funcione en un despliegue recién creado, antes de conectar la base. */
export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Detecta la llave equivocada sin lanzar, para que el diagnóstico de la
 *  portada pueda explicarlo en vez de romperse. */
export const hayLlaveSecretaExpuesta = () => {
  const llave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(llave && esLlaveSecreta(llave));
};
