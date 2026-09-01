'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CATALOGO } from '@/lib/catalogo';
import { createClient } from '@/lib/supabase-browser';
import { isSupabaseConfigured } from '@/lib/env';
import { cargarProyecto } from '@/lib/datos/proyecto';
import {
  actualizarProducto as actualizarEnNube, borrarProducto as borrarEnNube,
  crearProducto as crearEnNube, guardarEstado, listarEstados, listarProductos, listarTasas,
} from '@/lib/datos/inventario';
import type { ChecklistState, FxRates, Payer, Product, Settings } from '@/lib/engine/types';
import { AJUSTES_DEMO, PAGADORES_DEMO, PRODUCTOS_DEMO, TASAS_DEMO } from '@/lib/demo/datos';

const CLAVE_DEMO = 'bitacora-demo-v1';

/** `demo` = datos de ejemplo en este navegador. `nube` = la bitácora real,
 *  compartida con quien tenga acceso al proyecto. */
export type Modo = 'cargando' | 'demo' | 'nube';

interface Contexto {
  modo: Modo;
  error: string;
  productos: Product[];
  estados: Record<string, ChecklistState>;
  ajustes: Settings;
  pagadores: Payer[];
  tasas: FxRates;
  catalogo: typeof CATALOGO;
  agregarProducto: (p: Omit<Product, 'id'>) => Promise<void>;
  actualizarProducto: (id: string, cambios: Partial<Product>) => Promise<void>;
  borrarProducto: (id: string) => Promise<void>;
  actualizarEstado: (itemCode: string, cambios: Partial<ChecklistState>) => Promise<void>;
}

const Ctx = createContext<Contexto | null>(null);

const ESTADO_BASE: ChecklistState = {
  notApplicable: false, qtyNeeded: null, manualCompleted: false,
};

export function ProveedorDatos({ children }: { children: React.ReactNode }) {
  const [modo, setModo] = useState<Modo>('cargando');
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [productos, setProductos] = useState<Product[]>([]);
  const [estados, setEstados] = useState<Record<string, ChecklistState>>({});
  const [ajustes, setAjustes] = useState<Settings>(AJUSTES_DEMO);
  const [pagadores, setPagadores] = useState<Payer[]>(PAGADORES_DEMO);
  const [tasas, setTasas] = useState<FxRates>(TASAS_DEMO);

  const entrarEnDemo = useCallback(() => {
    setModo('demo');
    setProjectId(null);
    setPagadores(PAGADORES_DEMO);
    setTasas(TASAS_DEMO);
    try {
      const guardado = localStorage.getItem(CLAVE_DEMO);
      if (guardado) {
        const d = JSON.parse(guardado);
        setProductos(d.productos ?? PRODUCTOS_DEMO);
        setEstados(d.estados ?? {});
        setAjustes(d.ajustes ?? AJUSTES_DEMO);
        return;
      }
    } catch {
      // Navegador privado o almacenamiento bloqueado: se sigue sin persistir.
    }
    setProductos(PRODUCTOS_DEMO);
    setEstados({});
    setAjustes(AJUSTES_DEMO);
  }, []);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      if (!isSupabaseConfigured()) { entrarEnDemo(); return; }

      try {
        const supabase = createClient();
        const { data: sesion } = await supabase.auth.getUser();
        if (!sesion.user) { if (!cancelado) entrarEnDemo(); return; }

        const proyecto = await cargarProyecto(supabase);
        if (!proyecto) { if (!cancelado) entrarEnDemo(); return; }

        const [p, e, t] = await Promise.all([
          listarProductos(supabase, proyecto.id),
          listarEstados(supabase, proyecto.id),
          listarTasas(supabase),
        ]);
        if (cancelado) return;

        setProjectId(proyecto.id);
        setAjustes(proyecto.ajustes);
        setPagadores(proyecto.pagadores);
        setProductos(p);
        setEstados(e);
        setTasas(Object.keys(t).length > 0 ? t : TASAS_DEMO);
        setModo('nube');
      } catch {
        // Si la nube falla, la app sigue siendo útil en modo demostración.
        if (!cancelado) entrarEnDemo();
      }
    })();

    return () => { cancelado = true; };
  }, [entrarEnDemo]);

  // Persistencia sólo en demo: en la nube manda la base de datos.
  useEffect(() => {
    if (modo !== 'demo') return;
    try {
      localStorage.setItem(CLAVE_DEMO, JSON.stringify({ productos, estados, ajustes }));
    } catch {
      // Sin persistencia, pero la sesión actual funciona igual.
    }
  }, [modo, productos, estados, ajustes]);

  const valor = useMemo<Contexto>(() => ({
    modo, error, productos, estados, ajustes, pagadores, tasas, catalogo: CATALOGO,

    agregarProducto: async (p) => {
      setError('');
      if (modo === 'nube' && projectId) {
        try {
          const creado = await crearEnNube(createClient(), projectId, p, tasas);
          setProductos((prev) => [...prev, creado]);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'No se pudo guardar el producto.');
        }
        return;
      }
      setProductos((prev) => [...prev, { ...p, id: crypto.randomUUID() }]);
    },

    actualizarProducto: async (id, cambios) => {
      setError('');
      const anterior = productos.find((p) => p.id === id);
      if (modo === 'nube' && projectId && anterior) {
        try {
          const nuevo = await actualizarEnNube(createClient(), id, cambios, anterior, tasas);
          setProductos((prev) => prev.map((p) => (p.id === id ? nuevo : p)));
        } catch (e) {
          setError(e instanceof Error ? e.message : 'No se pudo actualizar.');
        }
        return;
      }
      setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
    },

    borrarProducto: async (id) => {
      setError('');
      const copia = productos;
      setProductos((prev) => prev.filter((p) => p.id !== id));
      if (modo === 'nube' && projectId) {
        try {
          await borrarEnNube(createClient(), id);
        } catch (e) {
          setProductos(copia); // Se deshace: la base manda.
          setError(e instanceof Error ? e.message : 'No se pudo borrar.');
        }
      }
    },

    actualizarEstado: async (itemCode, cambios) => {
      setError('');
      const nuevo = { ...(estados[itemCode] ?? ESTADO_BASE), ...cambios };
      setEstados((prev) => ({ ...prev, [itemCode]: nuevo }));
      if (modo === 'nube' && projectId) {
        try {
          await guardarEstado(createClient(), projectId, itemCode, nuevo);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'No se pudo guardar el checklist.');
        }
      }
    },
  }), [modo, error, productos, estados, ajustes, pagadores, tasas, projectId]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useApp(): Contexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp debe usarse dentro de ProveedorDatos');
  return ctx;
}
