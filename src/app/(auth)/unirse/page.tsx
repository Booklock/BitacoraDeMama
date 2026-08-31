'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Aviso, Boton, CampoTexto } from '@/components/CampoTexto';

/** Segundo camino de registro (decisión D4): quien recibe un código se une a
 *  una bitácora existente y no pasa por el asistente — la configuración ya
 *  la hizo la otra persona. */
export default function UnirsePage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (clave.length < 8) {
      setError('La contraseña necesita al menos 8 caracteres.');
      return;
    }

    setCargando(true);
    try {
      const supabase = createClient();

      // Puede que ya tenga cuenta: se intenta entrar y, si no existe, se crea.
      const entrada = await supabase.auth.signInWithPassword({
        email: correo.trim(), password: clave,
      });
      if (entrada.error) {
        const alta = await supabase.auth.signUp({ email: correo.trim(), password: clave });
        if (alta.error) {
          setError(alta.error.message);
          return;
        }
      }

      const { error: err } = await supabase.rpc('join_project_with_code', {
        p_code: codigo.trim().toUpperCase(),
      });
      if (err) {
        setError(err.message);
        return;
      }

      router.push('/configuracion');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <h1 className="text-xl font-semibold">Unirte a una bitácora</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Con el código que te compartieron verás la misma bitácora, con el mismo
        inventario y el mismo dashboard.
      </p>

      <form onSubmit={enviar} className="mt-6 space-y-4">
        <CampoTexto
          etiqueta="Código de invitación" required placeholder="LUNA-4K2P"
          value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          className="uppercase"
        />
        <CampoTexto
          etiqueta="Tu correo" type="email" required autoComplete="email"
          value={correo} onChange={(e) => setCorreo(e.target.value)}
        />
        <CampoTexto
          etiqueta="Tu contraseña" type="password" required autoComplete="new-password"
          ayuda="Si ya tenías cuenta, usa la de siempre. Si no, esta será tu contraseña."
          value={clave} onChange={(e) => setClave(e.target.value)}
        />
        <Aviso>{error}</Aviso>
        <Boton type="submit" cargando={cargando}>Unirme</Boton>
      </form>

      <p className="mt-5 text-center text-sm text-tinta-suave">
        ¿Prefieres empezar tu propia bitácora?{' '}
        <Link href="/crear-cuenta" className="font-medium text-verde-oscuro underline underline-offset-2">
          Crear una
        </Link>
      </p>
    </>
  );
}
