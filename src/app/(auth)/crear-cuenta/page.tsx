'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Aviso, Boton, CampoTexto } from '@/components/CampoTexto';
import { mensajeDeError } from '@/lib/mensajes';

export default function CrearCuentaPage() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [correo2, setCorreo2] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Se pide el correo dos veces porque no hay verificación por email
    // (decisión D5): sin esto, un correo mal escrito deja a la persona sin
    // forma de recuperar su contraseña.
    if (correo.trim().toLowerCase() !== correo2.trim().toLowerCase()) {
      setError('Los dos correos no coinciden. Revísalos antes de continuar.');
      return;
    }
    if (clave.length < 8) {
      setError('La contraseña necesita al menos 8 caracteres.');
      return;
    }

    setCargando(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signUp({
        email: correo.trim(),
        password: clave,
      });
      if (err) {
        setError(
          /already registered/i.test(err.message)
            ? 'Ya existe una cuenta con ese correo. Entra en vez de crearla.'
            : mensajeDeError(err),
        );
        return;
      }
      router.push('/primeros-pasos');
      router.refresh();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <h1 className="text-xl font-semibold">Crear tu cuenta</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Sin correos de confirmación: creas la cuenta y entras.
      </p>

      <form onSubmit={enviar} className="mt-6 space-y-4">
        <CampoTexto
          etiqueta="Correo" type="email" required autoComplete="email"
          value={correo} onChange={(e) => setCorreo(e.target.value)}
        />
        <CampoTexto
          etiqueta="Repite tu correo" type="email" required autoComplete="off"
          ayuda="Como no enviamos correo de confirmación, comprobamos que esté bien escrito."
          value={correo2} onChange={(e) => setCorreo2(e.target.value)}
          onPaste={(e) => e.preventDefault()}
        />
        <CampoTexto
          etiqueta="Contraseña" type="password" required autoComplete="new-password"
          ayuda="Mínimo 8 caracteres."
          value={clave} onChange={(e) => setClave(e.target.value)}
        />
        <Aviso>{error}</Aviso>
        <Boton type="submit" cargando={cargando}>Crear cuenta</Boton>
      </form>

      <div className="mt-5 space-y-2 text-center text-sm text-tinta-suave">
        <p>
          ¿Ya tienes cuenta?{' '}
          <Link href="/entrar" className="font-medium text-verde-oscuro underline underline-offset-2">
            Entrar
          </Link>
        </p>
        <p>
          ¿Te compartieron un código?{' '}
          <Link href="/unirse" className="font-medium text-verde-oscuro underline underline-offset-2">
            Unirte a una bitácora
          </Link>
        </p>
      </div>
    </>
  );
}
