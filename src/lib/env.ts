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

export const supabaseUrl = () =>
  required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabaseAnonKey = () =>
  required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** true cuando la app tiene Supabase configurado. Permite que la portada
 *  funcione en un despliegue recién creado, antes de conectar la base. */
export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
