'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Aviso, Boton, CampoTexto } from '@/components/CampoTexto';
import { mensajeDeError } from '@/lib/mensajes';

export default function EntrarPage() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password: clave,
      });
      if (err) {
        setError(
          /Invalid login/i.test(err.message)
            ? 'El correo o la contraseña no coinciden.'
            : mensajeDeError(err),
        );
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <h1 className="text-xl font-semibold">Entrar</h1>
      <p className="mt-1 text-sm text-tinta-suave">Bienvenida de vuelta.</p>

      <form onSubmit={enviar} className="mt-6 space-y-4">
        <CampoTexto
          etiqueta="Correo" type="email" required autoComplete="email"
          value={correo} onChange={(e) => setCorreo(e.target.value)}
        />
        <CampoTexto
          etiqueta="Contraseña" type="password" required autoComplete="current-password"
          value={clave} onChange={(e) => setClave(e.target.value)}
        />
        <Aviso>{error}</Aviso>
        <Boton type="submit" cargando={cargando}>Entrar</Boton>
      </form>

      <p className="mt-5 text-center text-sm text-tinta-suave">
        ¿Todavía no tienes cuenta?{' '}
        <Link href="/crear-cuenta" className="font-medium text-verde-oscuro underline underline-offset-2">
          Crear una
        </Link>
      </p>
    </>
  );
}
