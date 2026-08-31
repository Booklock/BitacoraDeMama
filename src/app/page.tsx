import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { EstadoConexion } from '@/components/EstadoConexion';

// El diagnóstico de conexión debe leerse en cada petición: si se prerenderizara
// en el build, quedaría congelado el estado de "falta conectar Supabase" incluso
// después de cargar las variables en Netlify.
export const dynamic = 'force-dynamic';

const COMO_FUNCIONA = [
  'Registras un producto en el Inventario: nombre, categoría QRH, ítem del checklist, precio, moneda y estado.',
  'Cada producto pertenece a un QRH (por ejemplo “On the Go”) y a un ítem dentro de ese QRH (“Stroller | Carrito”).',
  'Cuando lo marcas como comprado, el checklist correspondiente se marca solo.',
  'No importa cuál producto compraste: con que uno cumpla el ítem, queda completo.',
  'El Dashboard muestra el gasto y el avance de cada QRH en tiempo real.',
];

const SECCIONES = [
  {
    nombre: 'Configuración',
    texto:
      'Tu moneda y quién participa en los gastos. Se arma sola al crear la cuenta y puedes cambiarla cuando quieras.',
  },
  {
    nombre: 'Inventario',
    texto:
      'La única pantalla donde escribes. Cada producto con su categoría, precio, moneda, estado y quién lo pagó.',
  },
  {
    nombre: 'Checklists QRH',
    texto:
      'Los 13 checklists —Nursery, Wardrobe, Bath Time, Feeding, On the Go…— marcándose solos con lo que registras.',
  },
  {
    nombre: 'Dashboard',
    texto:
      'Tu resumen: valor total, comprado contra pendiente, gasto y progreso por QRH, y quién paga qué.',
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
      <header className="flex flex-col items-start gap-6">
        <div className="flex items-center gap-4">
          <span className="text-verde">
            <Logo className="h-14 w-14" />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Bitácora de Mamá</h1>
            <p className="mt-1 text-sm text-tinta-suave">
              Diario de vuelo — la maternidad organizada como un viaje seguro
            </p>
          </div>
        </div>

        <p className="max-w-2xl text-lg leading-relaxed text-tinta">
          Ordena las compras y los gastos del bebé sin llevar tres listas a la vez. Registras cada
          producto una sola vez y los checklists y el presupuesto se actualizan solos.
        </p>

        <p className="rounded-xl2 bg-azul-claro px-5 py-3 text-sm italic text-tinta-suave">
          “Not just checklists — flight procedures for the most important journey of your life.”
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/crear-cuenta"
            className="rounded-lg bg-verde px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-verde-oscuro"
          >
            Crear mi bitácora
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-verde-oscuro ring-1 ring-crema-borde transition-colors hover:bg-white"
          >
            Ver la demostración
          </Link>
          <Link href="/entrar" className="text-sm text-tinta-suave underline underline-offset-2 hover:text-tinta">
            Ya tengo cuenta
          </Link>
        </div>
      </header>

      <EstadoConexion />

      <section className="mt-14">
        <h2 className="text-xl font-semibold">Cómo funciona</h2>
        <ol className="mt-5 space-y-3">
          {COMO_FUNCIONA.map((paso, i) => (
            <li key={paso} className="flex gap-4 rounded-xl2 bg-white/70 p-4 ring-1 ring-crema-borde">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amarillo-suave text-sm font-semibold">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-tinta">{paso}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-semibold">Las cuatro secciones</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {SECCIONES.map((s) => (
            <article key={s.nombre} className="rounded-xl2 bg-white/70 p-5 ring-1 ring-crema-borde">
              <h3 className="font-semibold text-verde-oscuro">{s.nombre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-tinta-suave">{s.texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-xl2 bg-crema-calido p-6 ring-1 ring-crema-borde">
        <h2 className="text-xl font-semibold">¿Por qué QRH y en inglés?</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-tinta-suave">
          Usamos términos de aviación —QRH es <em>Quick Reference Handbook</em>, el manual que los
          pilotos consultan en cada procedimiento— como guiño al concepto de diario de vuelo de la
          marca. Cada categoría e ítem se muestra en inglés y español, por ejemplo{' '}
          <span className="font-medium text-tinta">Stroller | Carrito</span>, para que se entienda en
          cualquier país.
        </p>
      </section>

      <footer className="mt-16 border-t border-crema-borde pt-6 text-xs text-tinta-suave">
        Bitácora de Mamá © 2026 — hecho para acompañarte en cada etapa, en cualquier país.
      </footer>
    </main>
  );
}
