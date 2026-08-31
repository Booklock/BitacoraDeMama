'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ENLACES = [
  { href: '/dashboard', texto: 'Dashboard' },
  { href: '/inventario', texto: 'Inventario' },
  { href: '/checklists', texto: 'Checklists' },
  { href: '/configuracion', texto: 'Configuración' },
];

export function Navegacion() {
  const ruta = usePathname();

  return (
    <nav className="flex gap-1 text-sm">
      {ENLACES.map((e) => {
        const activo = ruta === e.href;
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? 'page' : undefined}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              activo
                ? 'bg-verde text-white'
                : 'text-tinta-suave hover:bg-crema-arena hover:text-tinta'
            }`}
          >
            {e.texto}
          </Link>
        );
      })}
    </nav>
  );
}
