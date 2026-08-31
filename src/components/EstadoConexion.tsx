import { createClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/env';

type Estado = {
  nivel: 'ok' | 'pendiente' | 'error';
  titulo: string;
  detalle: string;
  siguiente?: string;
  tecnico?: string;
};

type Recuentos = { qrh_categories: number; checklist_items: number; fx_rates: number };

/** Traduce el error de Supabase a algo accionable. Un mensaje genérico
 *  obliga a adivinar; el código de PostgREST dice exactamente qué falta. */
function interpretar(error: { code?: string; message?: string }): Estado {
  const codigo = error.code ?? '';
  const mensaje = error.message ?? 'Sin detalle';
  const tecnico = codigo ? `${codigo}: ${mensaje}` : mensaje;

  // La función no existe: falta la migración de funciones.
  if (codigo === 'PGRST202' || /Could not find the function/i.test(mensaje)) {
    return {
      nivel: 'pendiente',
      titulo: 'Falta ejecutar una migración',
      detalle:
        'Supabase responde correctamente, pero todavía no existe la función de diagnóstico.',
      siguiente:
        'Ejecuta en el SQL Editor el archivo 3: supabase/migrations/20260831000300_functions.sql',
      tecnico,
    };
  }

  // La tabla no existe: no se ejecutó ni el esquema.
  if (codigo === '42P01' || /relation .* does not exist/i.test(mensaje)) {
    return {
      nivel: 'pendiente',
      titulo: 'Falta crear las tablas',
      detalle: 'La base está conectada, pero está vacía.',
      siguiente: 'Ejecuta los archivos de supabase/migrations en orden (paso 4 de la guía).',
      tecnico,
    };
  }

  // Llave inválida.
  if (/Invalid API key|JWT|apikey/i.test(mensaje)) {
    return {
      nivel: 'error',
      titulo: 'La llave no es válida',
      detalle:
        'Revisa NEXT_PUBLIC_SUPABASE_ANON_KEY en Netlify: suele sobrar un espacio al copiar, o ser la llave de otro proyecto.',
      siguiente: 'Tras corregirla hay que volver a desplegar para que el sitio la tome.',
      tecnico,
    };
  }

  // No se llegó al servidor.
  if (/fetch failed|ENOTFOUND|network|ECONNREFUSED/i.test(mensaje)) {
    return {
      nivel: 'error',
      titulo: 'No se llegó al servidor',
      detalle: 'Revisa NEXT_PUBLIC_SUPABASE_URL: debe ser exactamente la Project URL de Supabase.',
      tecnico,
    };
  }

  return {
    nivel: 'error',
    titulo: 'Supabase devolvió un error',
    detalle: 'El detalle técnico de abajo indica la causa exacta.',
    tecnico,
  };
}

async function revisar(): Promise<Estado> {
  if (!isSupabaseConfigured()) {
    return {
      nivel: 'pendiente',
      titulo: 'Falta conectar Supabase',
      detalle: 'La app está desplegada, pero aún no tiene sus variables de entorno.',
      siguiente: 'Paso 3 de la guía: copiar la Project URL y la llave pública.',
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('installation_status');
    if (error) return interpretar(error);

    const c = data as Recuentos;
    if (c.checklist_items === 0) {
      return {
        nivel: 'pendiente',
        titulo: 'Falta sembrar el catálogo',
        detalle: 'Las tablas existen, pero están vacías.',
        siguiente:
          'Ejecuta el archivo 4: supabase/migrations/20260831000400_seed_catalog.sql',
      };
    }

    return {
      nivel: 'ok',
      titulo: 'Base de datos conectada',
      detalle: `${c.qrh_categories} categorías · ${c.checklist_items} ítems · ${c.fx_rates} monedas`,
    };
  } catch (e) {
    return interpretar(e as { code?: string; message?: string });
  }
}

const ESTILOS = {
  ok:        { caja: 'bg-white/70 ring-verde/30',      punto: 'bg-verde' },
  pendiente: { caja: 'bg-white/70 ring-amarillo/40',   punto: 'bg-amarillo' },
  error:     { caja: 'bg-white/70 ring-alerta',        punto: 'bg-alerta' },
} as const;

export async function EstadoConexion() {
  const estado = await revisar();
  const estilo = ESTILOS[estado.nivel];

  return (
    <aside className={`mt-10 rounded-xl2 px-5 py-4 ring-1 ${estilo.caja}`}>
      <div className="flex items-center gap-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${estilo.punto}`} aria-hidden />
        <h2 className="text-sm font-semibold">{estado.titulo}</h2>
      </div>
      <p className="mt-1.5 pl-[1.125rem] text-sm text-tinta-suave">{estado.detalle}</p>
      {estado.siguiente && (
        <p className="mt-1 pl-[1.125rem] text-sm text-tinta-suave">{estado.siguiente}</p>
      )}
      {estado.tecnico && (
        <p className="mt-2 pl-[1.125rem] font-mono text-xs text-tinta-suave/80">{estado.tecnico}</p>
      )}
    </aside>
  );
}
