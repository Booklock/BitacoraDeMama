import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { ProveedorDemo } from '@/lib/demo/EstadoApp';
import { Navegacion } from '@/components/Navegacion';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorDemo>
      <div className="min-h-screen">
        <header className="border-b border-crema-borde bg-white/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
            <Link href="/" className="flex items-center gap-2.5 text-verde">
              <Logo className="h-7 w-7" />
              <span className="text-sm font-semibold text-tinta">Bitácora de Mamá</span>
            </Link>
            <Navegacion />
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-5 py-3">
          <p className="rounded-lg bg-amarillo-suave px-3 py-2 text-xs text-tinta-suave">
            Estás viendo una <strong className="font-semibold text-tinta">demostración</strong> con
            datos de ejemplo. Puedes agregar, editar y borrar: los cambios se guardan en tu
            navegador y no salen de tu equipo.
          </p>
        </div>

        <main className="mx-auto max-w-6xl px-5 pb-16">{children}</main>
      </div>
    </ProveedorDemo>
  );
}
