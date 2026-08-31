import { createClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/env';

type Estado = {
  ok: boolean;
  titulo: string;
  detalle: string;
  siguiente: string;
};

type Recuentos = { qrh_categories: number; checklist_items: number; fx_rates: number };

async function revisar(): Promise<Estado> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      titulo: 'Falta conectar Supabase',
      detalle:
        'La app está desplegada, pero todavía no tiene las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      siguiente: 'Paso 3 de la guía: crear el proyecto en Supabase y copiar sus llaves.',
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('installation_status');
    if (error) throw error;

    const c = data as Recuentos;
    if (c.checklist_items === 0) {
      return {
        ok: false,
        titulo: 'Base conectada, catálogo vacío',
        detalle: 'Supabase responde, pero las migraciones de semilla todavía no se ejecutaron.',
        siguiente: 'Paso 4 de la guía: ejecutar las migraciones de supabase/migrations.',
      };
    }

    return {
      ok: true,
      titulo: 'Todo listo',
      detalle: `${c.qrh_categories} categorías QRH, ${c.checklist_items} ítems de checklist y ${c.fx_rates} monedas cargadas.`,
      siguiente: 'La base está conectada y sembrada.',
    };
  } catch {
    return {
      ok: false,
      titulo: 'No se pudo consultar la base',
      detalle:
        'Las variables existen, pero Supabase no respondió. Suele ser una llave mal copiada o las migraciones sin ejecutar.',
      siguiente: 'Revisa los pasos 3 y 4 de docs/05-despliegue.md.',
    };
  }
}

export async function EstadoConexion() {
  const estado = await revisar();

  return (
    <aside
      className={`mt-10 rounded-xl2 p-5 ring-1 ${
        estado.ok ? 'bg-amarillo-suave ring-amarillo-oliva' : 'bg-alerta/40 ring-alerta'
      }`}
    >
      <div className="flex items-baseline gap-3">
        <span aria-hidden>{estado.ok ? '✓' : '•'}</span>
        <h2 className="font-semibold">{estado.titulo}</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-tinta-suave">{estado.detalle}</p>
      <p className="mt-1 text-sm leading-relaxed text-tinta-suave">{estado.siguiente}</p>
    </aside>
  );
}
