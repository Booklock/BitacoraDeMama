import type { SupabaseClient } from '@supabase/supabase-js';
import type { Payer, Settings } from '@/lib/engine/types';

export interface FilaPagador {
  id: string;
  project_id: string;
  role: Payer['role'];
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface Proyecto {
  id: string;
  ajustes: Settings;
  pagadores: Payer[];
  miRol: 'owner' | 'member';
}

/** El proyecto del usuario con sesión, o null si todavía no tiene. */
export async function cargarProyecto(supabase: SupabaseClient): Promise<Proyecto | null> {
  const { data: proyectos, error } = await supabase
    .from('mis_proyectos')
    .select('id, mi_rol')
    .limit(1);

  if (error) throw error;
  if (!proyectos || proyectos.length === 0) return null;

  const id = proyectos[0].id as string;

  const [{ data: ajustes }, { data: pagadores }] = await Promise.all([
    supabase.from('project_settings').select('*').eq('project_id', id).single(),
    supabase.from('payers').select('*').eq('project_id', id).order('sort_order'),
  ]);

  return {
    id,
    miRol: proyectos[0].mi_rol as 'owner' | 'member',
    ajustes: {
      currencyCode: ajustes?.currency_code ?? 'USD',
      babyName: ajustes?.baby_name ?? '',
      fatherLastname: ajustes?.father_lastname ?? '',
      motherLastname: ajustes?.mother_lastname ?? '',
    },
    pagadores: ((pagadores ?? []) as FilaPagador[]).map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      order: p.sort_order,
    })),
  };
}

export interface PagadorNuevo {
  role: Payer['role'];
  name: string;
}

/** Crea el proyecto y sus pagadores. Todo lo del asistente es opcional:
 *  si no se escribe nada, queda un proyecto usable con valores por defecto. */
export async function crearProyecto(
  supabase: SupabaseClient,
  datos: {
    currencyCode: string;
    pagadores: PagadorNuevo[];
    miIndicePagador: number | null;
    ajustes: Partial<Settings>;
  },
): Promise<string> {
  const { data: projectId, error } = await supabase.rpc('create_project', {
    p_currency_code: datos.currencyCode,
  });
  if (error) throw error;

  const conNombre = datos.pagadores.filter((p) => p.name.trim() !== '');
  let insertados: FilaPagador[] = [];

  if (conNombre.length > 0) {
    const { data, error: errPagadores } = await supabase
      .from('payers')
      .insert(
        conNombre.map((p, i) => ({
          project_id: projectId,
          role: p.role,
          name: p.name.trim(),
          sort_order: i + 1,
        })),
      )
      .select();
    if (errPagadores) throw errPagadores;
    insertados = (data ?? []) as FilaPagador[];
  }

  // Enlaza a quien se registró con su propio pagador, para saber quién es
  // quién cuando el proyecto lo comparten dos personas.
  const indice = datos.miIndicePagador;
  if (indice != null && conNombre[indice]) {
    const mio = insertados.find((p) => p.name === conNombre[indice].name.trim());
    if (mio) {
      const { data: sesion } = await supabase.auth.getUser();
      if (sesion.user) {
        await supabase
          .from('project_members')
          .update({ payer_id: mio.id })
          .eq('project_id', projectId)
          .eq('user_id', sesion.user.id);
      }
    }
  }

  await guardarAjustes(supabase, projectId as string, datos.ajustes);

  // La lista recomendada es la base del producto: la bitácora no nace vacía.
  // Si esto fallara, el proyecto ya es usable, así que no se tumba el alta.
  const { error: errPrecarga } = await supabase.rpc('precargar_sugerencias', {
    p_project_id: projectId,
  });
  if (errPrecarga) {
    console.warn('No se pudo precargar la lista recomendada:', errPrecarga.message);
  }

  return projectId as string;
}

/** Vuelve a precargar lo que falte del catálogo. Es idempotente: no duplica
 *  lo que ya está en el inventario. */
export async function precargarSugerencias(
  supabase: SupabaseClient, projectId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('precargar_sugerencias', {
    p_project_id: projectId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function guardarAjustes(
  supabase: SupabaseClient,
  projectId: string,
  ajustes: Partial<Settings>,
): Promise<void> {
  const fila: Record<string, string> = {};
  if (ajustes.currencyCode !== undefined) fila.currency_code = ajustes.currencyCode;
  if (ajustes.babyName !== undefined) fila.baby_name = ajustes.babyName.trim();
  if (ajustes.fatherLastname !== undefined) fila.father_lastname = ajustes.fatherLastname.trim();
  if (ajustes.motherLastname !== undefined) fila.mother_lastname = ajustes.motherLastname.trim();
  if (Object.keys(fila).length === 0) return;

  const { error } = await supabase
    .from('project_settings')
    .update(fila)
    .eq('project_id', projectId);
  if (error) throw error;
}

export async function agregarPagador(
  supabase: SupabaseClient,
  projectId: string,
  pagador: PagadorNuevo,
  orden: number,
): Promise<void> {
  const { error } = await supabase.from('payers').insert({
    project_id: projectId,
    role: pagador.role,
    name: pagador.name.trim(),
    sort_order: orden,
  });
  if (error) throw error;
}

export async function renombrarPagador(
  supabase: SupabaseClient, id: string, nombre: string,
): Promise<void> {
  const { error } = await supabase.from('payers').update({ name: nombre.trim() }).eq('id', id);
  if (error) throw error;
}

export async function borrarPagador(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('payers').delete().eq('id', id);
  if (error) throw error;
}

export async function crearCodigoInvitacion(
  supabase: SupabaseClient, projectId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_invite_code', { p_project_id: projectId });
  if (error) throw error;
  return data as string;
}
