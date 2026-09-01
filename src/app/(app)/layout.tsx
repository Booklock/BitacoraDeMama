import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { ProveedorDatos } from '@/lib/estado/ProveedorDatos';
import { Navegacion } from '@/components/Navegacion';
import { AvisoModo } from '@/components/AvisoModo';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorDatos>
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

        <AvisoModo />

        <main className="mx-auto max-w-6xl px-5 pb-16">{children}</main>
      </div>
    </ProveedorDatos>
  );
}
