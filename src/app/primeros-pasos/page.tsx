'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Aviso, Boton, CampoTexto } from '@/components/CampoTexto';
import { mensajeDeError } from '@/lib/mensajes';
import { Logo } from '@/components/Logo';
import { crearProyecto, type PagadorNuevo } from '@/lib/datos/proyecto';
import { MONEDAS, monedaDelNavegador } from '@/lib/monedas';

type Rol = 'mother' | 'father' | 'extra';

const ROLES: { valor: Rol; texto: string }[] = [
  { valor: 'mother', texto: 'La mamá' },
  { valor: 'father', texto: 'El papá' },
  { valor: 'extra', texto: 'Otra persona' },
];

export default function PrimerosPasosPage() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  // Paso 1 — quién eres
  const [miNombre, setMiNombre] = useState('');
  const [miRol, setMiRol] = useState<Rol>('mother');

  // Paso 2 — quién más participa
  const [hayPareja, setHayPareja] = useState(true);
  const [nombrePareja, setNombrePareja] = useState('');
  const [ayudantes, setAyudantes] = useState<string[]>(['']);

  // Paso 3 — el bebé
  const [nombreBebe, setNombreBebe] = useState('');
  const [apellidoPadre, setApellidoPadre] = useState('');
  const [apellidoMadre, setApellidoMadre] = useState('');
  const [moneda, setMoneda] = useState(monedaDelNavegador());

  const rolPareja: Rol = miRol === 'mother' ? 'father' : 'mother';

  const terminar = async () => {
    setError('');
    setCargando(true);
    try {
      const supabase = createClient();

      const pagadores: PagadorNuevo[] = [];
      pagadores.push({ role: miRol, name: miNombre.trim() || (miRol === 'father' ? 'Papá' : 'Mamá') });
      const miIndice = 0;

      if (hayPareja) {
        pagadores.push({
          role: rolPareja,
          name: nombrePareja.trim() || (rolPareja === 'father' ? 'Papá' : 'Mamá'),
        });
      }
      // Los dos pagadores del Excel que no son personas concretas.
      pagadores.push({ role: 'gift', name: 'Regalo (Baby Shower)' });
      pagadores.push({ role: 'shared', name: 'Común' });

      for (const nombre of ayudantes) {
        if (nombre.trim()) pagadores.push({ role: 'extra', name: nombre.trim() });
      }

      await crearProyecto(supabase, {
        currencyCode: moneda,
        pagadores,
        miIndicePagador: miIndice,
        ajustes: {
          babyName: nombreBebe,
          fatherLastname: apellidoPadre,
          motherLastname: apellidoMadre,
        },
      });

      router.push('/configuracion');
      router.refresh();
    } catch (e) {
      setError(`No se pudo crear tu bitácora. ${mensajeDeError(e)}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
      <div className="mb-6 flex items-center gap-2.5 text-verde">
        <Logo className="h-9 w-9" />
        <span className="text-base font-semibold text-tinta">Bitácora de Mamá</span>
      </div>

      <div className="rounded-xl2 bg-white/80 p-7 ring-1 ring-crema-borde">
        <div className="flex items-center gap-1.5" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full ${n <= paso ? 'bg-verde' : 'bg-crema-arena'}`}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-tinta-suave">Paso {paso} de 3</p>

        {paso === 1 && (
          <section className="mt-4 space-y-4">
            <div>
              <h1 className="text-xl font-semibold">¿Quién eres?</h1>
              <p className="mt-1 text-sm text-tinta-suave">
                Sirve para saber a quién asignar cada gasto. Puedes cambiarlo cuando quieras.
              </p>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-tinta">Eres…</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.valor}
                    type="button"
                    onClick={() => setMiRol(r.valor)}
                    aria-pressed={miRol === r.valor}
                    className={`rounded-lg px-3 py-1.5 text-sm ring-1 transition-colors ${
                      miRol === r.valor
                        ? 'bg-verde text-white ring-verde'
                        : 'bg-white text-tinta-suave ring-crema-borde hover:text-tinta'
                    }`}
                  >
                    {r.texto}
                  </button>
                ))}
              </div>
            </fieldset>

            <CampoTexto
              etiqueta="Tu nombre" value={miNombre}
              ayuda="Opcional. Si lo dejas vacío usamos “Mamá” o “Papá”."
              onChange={(e) => setMiNombre(e.target.value)}
            />
          </section>
        )}

        {paso === 2 && (
          <section className="mt-4 space-y-5">
            <div>
              <h1 className="text-xl font-semibold">¿Quién más participa?</h1>
              <p className="mt-1 text-sm text-tinta-suave">
                Todo esto es opcional y se puede editar después.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox" checked={hayPareja}
                  onChange={(e) => setHayPareja(e.target.checked)}
                  className="h-4 w-4 rounded border-crema-borde accent-[#33A372]"
                />
                Hay una pareja que también participa
              </label>

              {hayPareja && (
                <CampoTexto
                  etiqueta={rolPareja === 'father' ? 'Nombre del papá' : 'Nombre de la mamá'}
                  value={nombrePareja}
                  ayuda="Podrás invitarle desde Configuración para que vea la misma bitácora."
                  onChange={(e) => setNombrePareja(e.target.value)}
                />
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-tinta">¿Alguien más ayuda con las compras?</p>
              <p className="mt-1 text-xs text-tinta-suave">
                Los abuelos, tíos, madrinas… así sabes cuánto aportó cada quien.
              </p>
              <div className="mt-2 space-y-2">
                {ayudantes.map((nombre, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={nombre}
                      placeholder="Por ejemplo: Abuela Rosa"
                      onChange={(e) =>
                        setAyudantes((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      aria-label={`Persona que ayuda ${i + 1}`}
                      className="w-full rounded-lg border border-crema-borde bg-white px-3 py-2 text-sm"
                    />
                    {ayudantes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAyudantes((prev) => prev.filter((_, j) => j !== i))}
                        aria-label="Quitar"
                        className="rounded-lg px-3 text-sm text-tinta-suave hover:text-tinta"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAyudantes((prev) => [...prev, ''])}
                  className="text-sm font-medium text-verde-oscuro underline underline-offset-2"
                >
                  Agregar otra persona
                </button>
              </div>
            </div>
          </section>
        )}

        {paso === 3 && (
          <section className="mt-4 space-y-4">
            <div>
              <h1 className="text-xl font-semibold">El bebé</h1>
              <p className="mt-1 text-sm text-tinta-suave">
                Si todavía no tienen nombre, sáltalo: la app funciona igual y lo
                agregas cuando lo decidan.
              </p>
            </div>

            <CampoTexto
              etiqueta="Nombre del bebé" value={nombreBebe}
              onChange={(e) => setNombreBebe(e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto
                etiqueta="Apellido del papá" value={apellidoPadre}
                onChange={(e) => setApellidoPadre(e.target.value)}
              />
              <CampoTexto
                etiqueta="Apellido de la mamá" value={apellidoMadre}
                onChange={(e) => setApellidoMadre(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="moneda" className="block text-sm font-medium text-tinta">
                Moneda principal
              </label>
              <select
                id="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)}
                className="mt-1 w-full rounded-lg border border-crema-borde bg-white px-3 py-2 text-sm"
              >
                {MONEDAS.map((m) => (
                  <option key={m.codigo} value={m.codigo}>{m.etiqueta}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-tinta-suave">
                Podrás registrar compras en otras monedas: se convierten solas a ésta.
              </p>
            </div>
          </section>
        )}

        <Aviso>{error}</Aviso>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (paso === 1 ? router.push('/') : setPaso(paso - 1))}
            className="text-sm text-tinta-suave hover:text-tinta"
          >
            {paso === 1 ? 'Cancelar' : 'Atrás'}
          </button>

          <div className="w-40">
            {paso < 3 ? (
              <Boton type="button" onClick={() => setPaso(paso + 1)}>Continuar</Boton>
            ) : (
              <Boton type="button" onClick={terminar} cargando={cargando}>Crear mi bitácora</Boton>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-tinta-suave">
        Nada de esto es obligatorio. Todo se puede editar más adelante en Configuración.
      </p>
    </div>
  );
}
