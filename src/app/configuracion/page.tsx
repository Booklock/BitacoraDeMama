'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Logo } from '@/components/Logo';
import { Aviso, CampoTexto } from '@/components/CampoTexto';
import { Tarjeta } from '@/components/ui';
import { MONEDAS } from '@/lib/monedas';
import { missionId } from '@/lib/engine/dashboard';
import {
  agregarPagador, borrarPagador, cargarProyecto, crearCodigoInvitacion,
  guardarAjustes, renombrarPagador, type Proyecto,
} from '@/lib/datos/proyecto';

const NOMBRE_ROL: Record<string, string> = {
  mother: 'Mamá', father: 'Papá', gift: 'Regalos', shared: 'Gasto compartido', extra: 'Ayuda',
};

export default function ConfiguracionPage() {
  const router = useRouter();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin-sesion' | 'sin-proyecto' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState('');
  const [nuevoAyudante, setNuevoAyudante] = useState('');
  const [codigo, setCodigo] = useState('');

  const recargar = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: sesion } = await supabase.auth.getUser();
      if (!sesion.user) { setEstado('sin-sesion'); return; }

      const p = await cargarProyecto(supabase);
      if (!p) { setEstado('sin-proyecto'); return; }

      setProyecto(p);
      setEstado('listo');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.');
      setEstado('error');
    }
  }, []);

  useEffect(() => { void recargar(); }, [recargar]);

  const avisar = (texto: string) => {
    setGuardado(texto);
    setTimeout(() => setGuardado(''), 2500);
  };

  const conProyecto = async (accion: () => Promise<void>, mensaje: string) => {
    setError('');
    try {
      await accion();
      await recargar();
      avisar(mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    }
  };

  if (estado === 'cargando') {
    return <Marco><p className="text-sm text-tinta-suave">Cargando…</p></Marco>;
  }

  if (estado === 'sin-sesion') {
    return (
      <Marco>
        <h1 className="text-xl font-semibold">Necesitas una cuenta</h1>
        <p className="mt-2 text-sm text-tinta-suave">
          La configuración se guarda en tu bitácora, así que hace falta entrar.
          También puedes recorrer la <Link href="/dashboard" className="underline">demostración</Link> sin cuenta.
        </p>
        <div className="mt-5 flex gap-3">
          <Link href="/crear-cuenta" className="rounded-lg bg-verde px-4 py-2 text-sm font-medium text-white">
            Crear cuenta
          </Link>
          <Link href="/entrar" className="rounded-lg px-4 py-2 text-sm text-tinta-suave hover:text-tinta">
            Entrar
          </Link>
        </div>
      </Marco>
    );
  }

  if (estado === 'sin-proyecto') {
    return (
      <Marco>
        <h1 className="text-xl font-semibold">Aún no tienes una bitácora</h1>
        <p className="mt-2 text-sm text-tinta-suave">Son tres pasos y todos son opcionales.</p>
        <Link
          href="/primeros-pasos"
          className="mt-5 inline-block rounded-lg bg-verde px-4 py-2 text-sm font-medium text-white"
        >
          Empezar
        </Link>
      </Marco>
    );
  }

  if (estado === 'error' || !proyecto) {
    return <Marco><Aviso>{error || 'No se pudo cargar la configuración.'}</Aviso></Marco>;
  }

  const { ajustes, pagadores, id, miRol } = proyecto;
  const ayudantes = pagadores.filter((p) => p.role === 'extra');
  const principales = pagadores.filter((p) => p.role !== 'extra');

  return (
    <Marco ancho>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Configuración</h1>
          <p className="mt-0.5 text-sm text-tinta-suave">
            Todo se puede cambiar cuando quieras.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await createClient().auth.signOut();
            router.push('/');
            router.refresh();
          }}
          className="text-sm text-tinta-suave underline underline-offset-2 hover:text-tinta"
        >
          Cerrar sesión
        </button>
      </div>

      {guardado && (
        <p className="mt-4 rounded-lg bg-amarillo-suave px-3 py-2 text-sm">{guardado}</p>
      )}
      <div className="mt-4"><Aviso>{error}</Aviso></div>

      <div className="mt-5 space-y-4">
        {/* Personas */}
        <Tarjeta titulo="Quién participa en los gastos">
          <ul className="space-y-2">
            {principales.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3">
                <span className="w-32 shrink-0 text-xs uppercase tracking-wide text-tinta-suave">
                  {NOMBRE_ROL[p.role]}
                </span>
                <input
                  defaultValue={p.name}
                  aria-label={`Nombre de ${NOMBRE_ROL[p.role]}`}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== p.name) {
                      void conProyecto(
                        () => renombrarPagador(createClient(), p.id, e.target.value),
                        'Nombre actualizado.',
                      );
                    }
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-crema-borde bg-white px-3 py-1.5 text-sm"
                />
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-crema-borde pt-4">
            <h3 className="text-sm font-medium">Quién más ayuda comprando</h3>
            <p className="mt-1 text-xs text-tinta-suave">
              Los abuelos, tíos, madrinas… Cada uno aparece en el dashboard con lo que aportó.
            </p>

            <ul className="mt-3 space-y-2">
              {ayudantes.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <input
                    defaultValue={p.name}
                    aria-label={`Nombre de ${p.name}`}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== p.name) {
                        void conProyecto(
                          () => renombrarPagador(createClient(), p.id, e.target.value),
                          'Nombre actualizado.',
                        );
                      }
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-crema-borde bg-white px-3 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void conProyecto(
                        () => borrarPagador(createClient(), p.id),
                        'Persona quitada.',
                      )
                    }
                    className="rounded-lg px-2 text-sm text-tinta-suave hover:text-tinta"
                    aria-label={`Quitar a ${p.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!nuevoAyudante.trim()) return;
                const nombre = nuevoAyudante;
                setNuevoAyudante('');
                void conProyecto(
                  () => agregarPagador(
                    createClient(), id, { role: 'extra', name: nombre }, pagadores.length + 1,
                  ),
                  'Persona agregada.',
                );
              }}
            >
              <input
                value={nuevoAyudante}
                onChange={(e) => setNuevoAyudante(e.target.value)}
                placeholder="Por ejemplo: Abuela Rosa"
                aria-label="Nombre de la persona que ayuda"
                className="min-w-0 flex-1 rounded-lg border border-crema-borde bg-white px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-verde px-3 py-1.5 text-sm font-medium text-white hover:bg-verde-oscuro"
              >
                Agregar
              </button>
            </form>
          </div>
        </Tarjeta>

        {/* Bebé */}
        <Tarjeta titulo="Datos del bebé">
          <p className="-mt-2 mb-3 text-xs text-tinta-suave">
            Si todavía no hay nombre, déjalo vacío. Se puede completar después.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {([
              ['Nombre del bebé', 'babyName', ajustes.babyName],
              ['Apellido del papá', 'fatherLastname', ajustes.fatherLastname],
              ['Apellido de la mamá', 'motherLastname', ajustes.motherLastname],
            ] as const).map(([etiqueta, campo, valor]) => (
              <CampoTexto
                key={campo}
                etiqueta={etiqueta}
                defaultValue={valor}
                onBlur={(e) => {
                  if (e.target.value !== valor) {
                    void conProyecto(
                      () => guardarAjustes(createClient(), id, { [campo]: e.target.value }),
                      'Guardado.',
                    );
                  }
                }}
              />
            ))}
          </div>
          {ajustes.babyName && (
            <p className="mt-3 text-xs text-tinta-suave">
              Mission ID: <span className="font-mono">{missionId(ajustes.babyName)}</span>
            </p>
          )}
        </Tarjeta>

        {/* Moneda */}
        <Tarjeta titulo="Moneda principal">
          <select
            value={ajustes.currencyCode}
            aria-label="Moneda principal"
            onChange={(e) =>
              void conProyecto(
                () => guardarAjustes(createClient(), id, { currencyCode: e.target.value }),
                'Moneda actualizada.',
              )
            }
            className="w-full max-w-sm rounded-lg border border-crema-borde bg-white px-3 py-2 text-sm"
          >
            {MONEDAS.map((m) => (
              <option key={m.codigo} value={m.codigo}>{m.etiqueta}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-tinta-suave">
            Puedes registrar compras en cualquier moneda: se convierten a ésta
            automáticamente. Lo ya comprado conserva el cambio del día en que se compró.
          </p>
        </Tarjeta>

        {/* Invitación */}
        {miRol === 'owner' && (
          <Tarjeta titulo="Compartir con tu pareja">
            <p className="-mt-2 text-sm text-tinta-suave">
              Genera un código y compártelo. Quien lo use verá esta misma bitácora,
              con el mismo inventario y el mismo dashboard.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  setError('');
                  try {
                    setCodigo(await crearCodigoInvitacion(createClient(), id));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'No se pudo generar el código.');
                  }
                }}
                className="rounded-lg bg-verde px-4 py-2 text-sm font-medium text-white hover:bg-verde-oscuro"
              >
                Generar código
              </button>
              {codigo && (
                <code className="rounded-lg bg-amarillo-suave px-3 py-2 font-mono text-base tracking-wider">
                  {codigo}
                </code>
              )}
            </div>
            {codigo && (
              <p className="mt-2 text-xs text-tinta-suave">
                Sirve una sola vez y vence en 30 días.
              </p>
            )}
          </Tarjeta>
        )}
      </div>
    </Marco>
  );
}

function Marco({ children, ancho }: { children: React.ReactNode; ancho?: boolean }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-crema-borde bg-white/60">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5 text-verde">
            <Logo className="h-7 w-7" />
            <span className="text-sm font-semibold text-tinta">Bitácora de Mamá</span>
          </Link>
          <Link href="/dashboard" className="ml-auto text-sm text-tinta-suave hover:text-tinta">
            Ver la demostración
          </Link>
        </div>
      </header>
      <main className={`mx-auto px-5 py-8 ${ancho ? 'max-w-3xl' : 'max-w-lg'}`}>{children}</main>
    </div>
  );
}
