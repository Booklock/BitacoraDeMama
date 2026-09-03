'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { Logo } from '@/components/Logo';
import { mensajeDeError } from '@/lib/mensajes';
import { formatearDinero } from '@/lib/engine/money';
import {
  liberar, marcarComprado, reservar, verCabecera, verLista,
  type CabeceraRegalos, type RegaloEnLista,
} from '@/lib/datos/regalos';

const CLAVE_NOMBRE = 'bitacora-nombre-regalo';

export function ListaRegalos({ token }: { token: string }) {
  const [cabecera, setCabecera] = useState<CabeceraRegalos | null>(null);
  const [regalos, setRegalos] = useState<RegaloEnLista[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const supabase = createClient();
      const [c, l] = await Promise.all([verCabecera(supabase, token), verLista(supabase, token)]);
      setCabecera(c);
      setRegalos(l);
      setEstado('listo');
    } catch (e) {
      setError(mensajeDeError(e));
      setEstado('error');
    }
  }, [token]);

  useEffect(() => {
    void cargar();
    try {
      setNombre(localStorage.getItem(CLAVE_NOMBRE) ?? '');
    } catch {
      // Sin almacenamiento; sólo significa escribir el nombre otra vez.
    }
  }, [cargar]);

  const recordarNombre = (valor: string) => {
    setNombre(valor);
    try {
      localStorage.setItem(CLAVE_NOMBRE, valor);
    } catch {
      // Da igual: el nombre se envía igualmente.
    }
  };

  const accion = async (id: string, fn: () => Promise<void>) => {
    setError('');
    setOcupado(id);
    try {
      await fn();
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  };

  if (estado === 'cargando') {
    return <Marco><p className="text-sm text-tinta-suave">Cargando la lista…</p></Marco>;
  }

  if (estado === 'error') {
    return (
      <Marco>
        <h1 className="text-xl font-semibold">No pudimos abrir la lista</h1>
        <p className="mt-2 text-sm text-tinta-suave">{error}</p>
        <p className="mt-3 text-sm text-tinta-suave">
          Puede que el enlace haya caducado. Pídeselo de nuevo a quien te lo compartió.
        </p>
      </Marco>
    );
  }

  const moneda = cabecera?.currency_code ?? 'USD';
  const bebe = cabecera?.baby_name?.trim();
  const disponibles = regalos.filter((r) => !r.reserved_by_name);
  const apartados = regalos.filter((r) => r.reserved_by_name);

  return (
    <Marco ancho>
      <h1 className="text-2xl font-semibold">
        {bebe ? `Lista de regalos para ${bebe}` : 'Lista de regalos'}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-tinta-suave">
        Esto es lo que todavía falta. Si quieres regalar algo, apúntalo con tu nombre
        para que nadie compre lo mismo dos veces.
      </p>

      <div className="mt-5 max-w-sm">
        <label htmlFor="nombre" className="block text-sm font-medium">Tu nombre</label>
        <input
          id="nombre"
          value={nombre}
          onChange={(e) => recordarNombre(e.target.value)}
          placeholder="Por ejemplo: Abuela Rosa"
          className="mt-1 w-full rounded-lg border border-crema-borde bg-white px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-tinta-suave">
          Sólo para que la familia sepa quién aporta qué. No hace falta crear cuenta.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-alerta/40 px-3 py-2 text-sm">{error}</p>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-tinta-suave">
          Todavía disponibles ({disponibles.length})
        </h2>
        {disponibles.length === 0 ? (
          <p className="mt-3 rounded-xl2 bg-white/70 p-5 text-sm text-tinta-suave ring-1 ring-crema-borde">
            No queda nada pendiente. ¡Gracias!
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {disponibles.map((r) => (
              <li key={r.id} className="rounded-xl2 bg-white/70 p-5 ring-1 ring-crema-borde">
                <Detalle regalo={r} moneda={moneda} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!nombre.trim() || ocupado === r.id}
                    onClick={() => accion(r.id, () => reservar(createClient(), token, r.id, nombre))}
                    className="rounded-lg bg-verde px-4 py-2 text-sm font-medium text-white hover:bg-verde-oscuro disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Yo lo compro
                  </button>
                  <button
                    type="button"
                    disabled={!nombre.trim() || ocupado === r.id}
                    onClick={() =>
                      accion(r.id, () => marcarComprado(createClient(), token, r.id, nombre))
                    }
                    className="rounded-lg px-4 py-2 text-sm font-medium text-verde-oscuro ring-1 ring-crema-borde hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Ya lo compré
                  </button>
                </div>
                {!nombre.trim() && (
                  <p className="mt-2 text-xs text-tinta-suave">
                    Escribe tu nombre arriba para poder apartarlo.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {apartados.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-tinta-suave">
            Ya apartados ({apartados.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {apartados.map((r) => (
              <li key={r.id} className="rounded-xl2 bg-crema-calido p-5 ring-1 ring-crema-borde">
                <Detalle regalo={r} moneda={moneda} />
                <p className="mt-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-azul-medio/40 px-2.5 py-0.5 text-xs font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-estado-apartado" aria-hidden />
                    Lo lleva {r.reserved_by_name}
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!nombre.trim() || ocupado === r.id}
                    onClick={() =>
                      accion(r.id, () => marcarComprado(createClient(), token, r.id, nombre))
                    }
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-verde-oscuro ring-1 ring-crema-borde hover:bg-white disabled:opacity-50"
                  >
                    Ya lo compré
                  </button>
                  <button
                    type="button"
                    disabled={ocupado === r.id}
                    onClick={() => accion(r.id, () => liberar(createClient(), token, r.id))}
                    className="rounded-lg px-3 py-1.5 text-xs text-tinta-suave underline underline-offset-2 hover:text-tinta"
                  >
                    Ya no lo llevo
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-xs text-tinta-suave">
        Esta lista sólo muestra lo que falta por comprar. No incluye lo que la familia
        ya tiene ni sus cuentas.
      </p>
    </Marco>
  );
}

function Detalle({ regalo, moneda }: { regalo: RegaloEnLista; moneda: string }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-semibold">{regalo.name}</h3>
        {regalo.price != null && (
          <span className="text-sm tabular-nums text-tinta-suave">
            {formatearDinero(regalo.price, regalo.currency_code ?? moneda)}
            {regalo.qty > 1 && ` · ${regalo.qty} unidades`}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-tinta-suave">
        {[regalo.item_name, regalo.brand, regalo.store].filter(Boolean).join(' · ')}
      </p>
      {regalo.url && (
        <a
          href={regalo.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-1 inline-block text-sm text-verde-oscuro underline underline-offset-2"
        >
          Ver dónde lo encontraron
        </a>
      )}
    </>
  );
}

function Marco({ children, ancho }: { children: React.ReactNode; ancho?: boolean }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-crema-borde bg-white/60">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-5 py-3 text-verde">
          <Logo className="h-7 w-7" />
          <span className="text-sm font-semibold text-tinta">Bitácora de Mamá</span>
        </div>
      </header>
      <main className={`mx-auto px-5 py-10 ${ancho ? 'max-w-3xl' : 'max-w-lg'}`}>{children}</main>
    </div>
  );
}
