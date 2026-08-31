'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CATALOGO } from '@/lib/catalogo';
import type { ChecklistState, Product, Settings } from '@/lib/engine/types';
import {
  AJUSTES_DEMO, PAGADORES_DEMO, PRODUCTOS_DEMO, TASAS_DEMO,
} from './datos';

const CLAVE = 'bitacora-demo-v1';

interface Contexto {
  productos: Product[];
  estados: Record<string, ChecklistState>;
  ajustes: Settings;
  pagadores: typeof PAGADORES_DEMO;
  tasas: typeof TASAS_DEMO;
  catalogo: typeof CATALOGO;
  agregarProducto: (p: Omit<Product, 'id'>) => void;
  actualizarProducto: (id: string, cambios: Partial<Product>) => void;
  borrarProducto: (id: string) => void;
  actualizarEstado: (itemCode: string, cambios: Partial<ChecklistState>) => void;
  actualizarAjustes: (cambios: Partial<Settings>) => void;
  reiniciar: () => void;
}

const Ctx = createContext<Contexto | null>(null);

const ESTADO_BASE: ChecklistState = {
  notApplicable: false, qtyNeeded: null, manualCompleted: false,
};

export function ProveedorDemo({ children }: { children: React.ReactNode }) {
  const [productos, setProductos] = useState<Product[]>(PRODUCTOS_DEMO);
  const [estados, setEstados] = useState<Record<string, ChecklistState>>({});
  const [ajustes, setAjustes] = useState<Settings>(AJUSTES_DEMO);
  const [cargado, setCargado] = useState(false);

  // Se guarda en el navegador para que los cambios de la demo sobrevivan a
  // una recarga. Es sólo para la demo: los datos reales irán a Supabase.
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE);
      if (guardado) {
        const d = JSON.parse(guardado);
        if (d.productos) setProductos(d.productos);
        if (d.estados) setEstados(d.estados);
        if (d.ajustes) setAjustes(d.ajustes);
      }
    } catch {
      // Navegador privado o almacenamiento bloqueado: se sigue con la demo.
    }
    setCargado(true);
  }, []);

  useEffect(() => {
    if (!cargado) return;
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ productos, estados, ajustes }));
    } catch {
      // Sin persistencia, pero la sesión actual funciona igual.
    }
  }, [productos, estados, ajustes, cargado]);

  const valor = useMemo<Contexto>(() => ({
    productos, estados, ajustes,
    pagadores: PAGADORES_DEMO,
    tasas: TASAS_DEMO,
    catalogo: CATALOGO,
    agregarProducto: (p) =>
      setProductos((prev) => [...prev, { ...p, id: crypto.randomUUID() }]),
    actualizarProducto: (id, cambios) =>
      setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p))),
    borrarProducto: (id) => setProductos((prev) => prev.filter((p) => p.id !== id)),
    actualizarEstado: (itemCode, cambios) =>
      setEstados((prev) => ({
        ...prev,
        [itemCode]: { ...(prev[itemCode] ?? ESTADO_BASE), ...cambios },
      })),
    actualizarAjustes: (cambios) => setAjustes((prev) => ({ ...prev, ...cambios })),
    reiniciar: () => {
      setProductos(PRODUCTOS_DEMO);
      setEstados({});
      setAjustes(AJUSTES_DEMO);
    },
  }), [productos, estados, ajustes]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useApp(): Contexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp debe usarse dentro de ProveedorDemo');
  return ctx;
}
