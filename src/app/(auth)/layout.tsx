import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="mb-6 flex items-center gap-2.5 text-verde">
        <Logo className="h-9 w-9" />
        <span className="text-base font-semibold text-tinta">Bitácora de Mamá</span>
      </Link>
      <div className="w-full max-w-md rounded-xl2 bg-white/80 p-7 ring-1 ring-crema-borde">
        {children}
      </div>
    </div>
  );
}
