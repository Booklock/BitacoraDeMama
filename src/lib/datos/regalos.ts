import type { SupabaseClient } from '@supabase/supabase-js';

export interface RegaloEnLista {
  id: string;
  name: string;
  brand: string | null;
  store: string | null;
  url: string | null;
  price: number | null;
  currency_code: string | null;
  qty: number;
  qrh_name: string | null;
  item_name: string | null;
  reserved_by_name: string | null;
  reserved_at: string | null;
}

export interface CabeceraRegalos {
  baby_name: string;
  currency_code: string;
}

export async function verCabecera(
  supabase: SupabaseClient, token: string,
): Promise<CabeceraRegalos> {
  const { data, error } = await supabase.rpc('ver_cabecera_regalos', { p_token: token });
  if (error) throw error;
  return data as CabeceraRegalos;
}

export async function verLista(
  supabase: SupabaseClient, token: string,
): Promise<RegaloEnLista[]> {
  const { data, error } = await supabase.rpc('ver_lista_regalos', { p_token: token });
  if (error) throw error;
  return (data ?? []) as RegaloEnLista[];
}

export async function reservar(
  supabase: SupabaseClient, token: string, productId: string, nombre: string,
): Promise<void> {
  const { error } = await supabase.rpc('reservar_regalo', {
    p_token: token, p_product_id: productId, p_nombre: nombre,
  });
  if (error) throw error;
}

export async function liberar(
  supabase: SupabaseClient, token: string, productId: string,
): Promise<void> {
  const { error } = await supabase.rpc('liberar_regalo', {
    p_token: token, p_product_id: productId,
  });
  if (error) throw error;
}

export async function marcarComprado(
  supabase: SupabaseClient, token: string, productId: string, nombre: string,
): Promise<void> {
  const { error } = await supabase.rpc('marcar_regalo_comprado', {
    p_token: token, p_product_id: productId, p_nombre: nombre,
  });
  if (error) throw error;
}

export async function crearEnlaceRegalos(
  supabase: SupabaseClient, projectId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('crear_enlace_regalos', {
    p_project_id: projectId,
  });
  if (error) throw error;
  return data as string;
}

export async function revocarEnlaceRegalos(
  supabase: SupabaseClient, token: string,
): Promise<void> {
  const { error } = await supabase.rpc('revocar_enlace_regalos', { p_token: token });
  if (error) throw error;
}
