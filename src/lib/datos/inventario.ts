import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChecklistState, FxRates, Product } from '@/lib/engine/types';
import { ESTADOS_QUE_COMPLETAN } from '@/lib/engine/types';

interface FilaProducto {
  id: string;
  name: string;
  qrh_code: string | null;
  item_code: string | null;
  brand: string | null;
  store: string | null;
  url: string | null;
  price: number | null;
  currency_code: string | null;
  qty: number;
  status: Product['status'];
  payer_id: string | null;
  notes: string | null;
  stage: Product['stage'];
  fx_rate_to_usd: number | null;
}

const aProducto = (f: FilaProducto): Product => ({
  id: f.id,
  name: f.name,
  qrhCode: f.qrh_code,
  itemCode: f.item_code,
  brand: f.brand ?? undefined,
  store: f.store ?? undefined,
  url: f.url ?? undefined,
  price: f.price,
  currencyCode: f.currency_code,
  qty: f.qty,
  status: f.status,
  payerId: f.payer_id,
  notes: f.notes ?? undefined,
  stage: f.stage,
  fxRateToUsd: f.fx_rate_to_usd,
});

const aFila = (p: Partial<Product>): Record<string, unknown> => {
  const fila: Record<string, unknown> = {};
  if (p.name !== undefined) fila.name = p.name;
  if (p.qrhCode !== undefined) fila.qrh_code = p.qrhCode;
  if (p.itemCode !== undefined) fila.item_code = p.itemCode;
  if (p.brand !== undefined) fila.brand = p.brand ?? null;
  if (p.store !== undefined) fila.store = p.store ?? null;
  if (p.url !== undefined) fila.url = p.url ?? null;
  if (p.price !== undefined) fila.price = p.price;
  if (p.currencyCode !== undefined) fila.currency_code = p.currencyCode;
  if (p.qty !== undefined) fila.qty = p.qty;
  if (p.status !== undefined) fila.status = p.status;
  if (p.payerId !== undefined) fila.payer_id = p.payerId;
  if (p.notes !== undefined) fila.notes = p.notes ?? null;
  if (p.stage !== undefined) fila.stage = p.stage;
  if (p.fxRateToUsd !== undefined) fila.fx_rate_to_usd = p.fxRateToUsd;
  return fila;
};

export async function listarTasas(supabase: SupabaseClient): Promise<FxRates> {
  const { data, error } = await supabase.from('fx_rates').select('currency_code, rate_to_usd');
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((r) => [r.currency_code as string, Number(r.rate_to_usd)]),
  );
}

export async function listarProductos(
  supabase: SupabaseClient, projectId: string,
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as FilaProducto[]).map(aProducto);
}

/** Congela la tasa del día si el producto pasa a estar comprado o apartado y
 *  todavía no la tenía (decisión D7). Lo pendiente no congela nada. */
function tasaACongelar(
  status: Product['status'] | undefined,
  currencyCode: string | null | undefined,
  yaCongelada: number | null | undefined,
  tasas: FxRates,
): number | null | undefined {
  if (!status) return undefined;
  if (!ESTADOS_QUE_COMPLETAN.includes(status)) return null;
  if (yaCongelada != null) return undefined;
  return currencyCode ? (tasas[currencyCode] ?? null) : null;
}

export async function crearProducto(
  supabase: SupabaseClient,
  projectId: string,
  producto: Omit<Product, 'id'>,
  tasas: FxRates,
): Promise<Product> {
  const { data: sesion } = await supabase.auth.getUser();
  const fila = {
    ...aFila(producto),
    project_id: projectId,
    created_by: sesion.user?.id ?? null,
    fx_rate_to_usd: tasaACongelar(producto.status, producto.currencyCode, null, tasas) ?? null,
    fx_rate_locked_at: ESTADOS_QUE_COMPLETAN.includes(producto.status)
      ? new Date().toISOString()
      : null,
  };

  const { data, error } = await supabase.from('products').insert(fila).select().single();
  if (error) throw error;
  return aProducto(data as FilaProducto);
}

export async function actualizarProducto(
  supabase: SupabaseClient,
  id: string,
  cambios: Partial<Product>,
  anterior: Product,
  tasas: FxRates,
): Promise<Product> {
  const fila = aFila(cambios);

  if (cambios.status !== undefined) {
    const tasa = tasaACongelar(
      cambios.status,
      cambios.currencyCode ?? anterior.currencyCode,
      anterior.fxRateToUsd,
      tasas,
    );
    if (tasa !== undefined) {
      fila.fx_rate_to_usd = tasa;
      fila.fx_rate_locked_at = tasa == null ? null : new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('products').update(fila).eq('id', id).select().single();
  if (error) throw error;
  return aProducto(data as FilaProducto);
}

export async function borrarProducto(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

interface FilaEstado {
  item_code: string;
  not_applicable: boolean;
  qty_needed: number | null;
  notes: string | null;
  manual_completed: boolean;
}

export async function listarEstados(
  supabase: SupabaseClient, projectId: string,
): Promise<Record<string, ChecklistState>> {
  const { data, error } = await supabase
    .from('checklist_states').select('*').eq('project_id', projectId);
  if (error) throw error;
  return Object.fromEntries(
    ((data ?? []) as FilaEstado[]).map((f) => [
      f.item_code,
      {
        notApplicable: f.not_applicable,
        qtyNeeded: f.qty_needed,
        manualCompleted: f.manual_completed,
        notes: f.notes ?? undefined,
      },
    ]),
  );
}

export async function guardarEstado(
  supabase: SupabaseClient,
  projectId: string,
  itemCode: string,
  estado: ChecklistState,
): Promise<void> {
  const { error } = await supabase.from('checklist_states').upsert(
    {
      project_id: projectId,
      item_code: itemCode,
      not_applicable: estado.notApplicable,
      qty_needed: estado.qtyNeeded,
      manual_completed: estado.manualCompleted,
      notes: estado.notes ?? null,
    },
    { onConflict: 'project_id,item_code' },
  );
  if (error) throw error;
}
