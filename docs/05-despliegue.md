# 05 · Puesta en marcha: Supabase + Netlify

Guía paso a paso para dejar la app viva. Son unos 20 minutos la primera vez.
Todo lo que hay que hacer aquí es en interfaces web: no hace falta instalar nada.

**Qué hace cada servicio.** Supabase guarda los datos (las cuentas, el inventario,
los checklists). Netlify publica la web y la conecta con Supabase. Los dos tienen
plan gratuito suficiente para empezar.

> **Cómo saber si va bien.** La portada de la app trae un recuadro de diagnóstico
> que dice en qué paso está: si falta conectar Supabase, si falta sembrar el
> catálogo, o si ya está todo listo. Recárgala después de cada paso.

---

## Paso 1 · Crear la cuenta de Supabase y el proyecto

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta (sirve el login con GitHub).
2. **New project**, dentro de tu organización.
3. Rellena:
   - **Name**: `bitacora-de-mama`
   - **Database Password**: genera una y **guárdala en su gestor de contraseñas**.
     No la vas a usar en el día a día, pero recuperarla después es un lío.
   - **Region**: la más cercana a sus usuarias. Si están en Centroamérica o México,
     `East US (North Virginia)`; si el público es España, `EU (Frankfurt)`.
4. **Create new project** y espera un par de minutos a que termine de aprovisionar.

## Paso 2 · Desactivar la verificación de correo

Esto implementa la decisión D5: registrarse y entrar directo, sin pasar por el correo.

1. En el menú lateral: **Authentication → Sign In / Providers → Email**.
2. Desactiva **Confirm email**.
3. **Save**.

> Recuerda el riesgo que aceptamos en D5: sin verificación, quien escriba mal su
> correo no podrá recuperar la contraseña. Por eso el registro pedirá el correo dos veces.

## Paso 3 · Copiar las llaves

1. **Project Settings → API**.
2. Copia estos dos valores, que usarás en el paso 5:
   - **Project URL** → será `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** (o *publishable key*) → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Cómo se llaman las llaves

Hay dos «nombres» distintos y sólo uno es obligatorio.

**El nombre de la variable de entorno: exacto.** El código busca esos textos
literales, así que se copian tal cual, en mayúsculas y con guiones bajos:

| Nombre exacto | Valor |
|---------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | la Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la llave pública |

El prefijo `NEXT_PUBLIC_` no es decorativo: Next.js sólo expone al navegador las
variables que empiezan así. Quitárselo rompe la app, y ponérselo a la llave secreta
la publicaría.

**El nombre que Supabase pide al crear una llave: libre.** Es sólo una etiqueta para
distinguirlas. Una convención que funciona: `bitacora-web-produccion` para la de
Netlify y `bitacora-web-local` para desarrollo, de modo que revocar una no deje a
nadie adivinando cuál era.

**Equivalencia con los nombres nuevos de Supabase.** Supabase renombró sus llaves, así
que puede que veas *publishable* y *secret* en lugar de *anon* y *service_role*:

| Supabase la llama | Va en | ¿Secreta? |
|-------------------|-------|-----------|
| `anon` / `publishable` (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No |
| `service_role` / `secret` (`sb_secret_…`) | ninguna variable, por ahora | **Sí** |

Aunque nuestra variable se llame `ANON_KEY`, ahí va la *publishable*: el nombre de la
variable es interno del proyecto y no tiene por qué coincidir con el de Supabase.

> **Regla para no equivocarse:** si la llave empieza por `sb_secret_` o dice
> `service_role`, no va en ninguna variable que empiece por `NEXT_PUBLIC_`.

**Sobre la seguridad de estas llaves.** La llave `anon` viaja al navegador y eso es
correcto por diseño: no es un secreto. Lo que protege los datos es Row Level Security,
que ya está configurado en las migraciones — cada quien sólo puede leer los proyectos
de los que es miembro.

En cambio, la llave **`service_role` se salta RLS por completo**. Esa no se pone nunca
en una variable `NEXT_PUBLIC_`, no se sube al repositorio, y de momento no hace falta
para nada: las migraciones se ejecutan desde el panel de Supabase.

## Paso 4 · Crear las tablas y sembrar el catálogo

En el menú lateral: **SQL Editor → New query**. Vas a ejecutar **cuatro archivos, en
este orden**. Para cada uno: abre el archivo del repositorio, copia todo su contenido,
pégalo en el editor y pulsa **Run**.

| Orden | Archivo | Qué hace |
|-------|---------|----------|
| 1 | `supabase/migrations/20260831000100_schema.sql` | Crea las tablas y los tipos |
| 2 | `supabase/migrations/20260831000200_rls.sql` | Activa la seguridad por filas |
| 3 | `supabase/migrations/20260831000300_functions.sql` | Alta de proyecto, invitaciones, diagnóstico |
| 4 | `supabase/migrations/20260831000400_seed_catalog.sql` | Carga 13 QRH, 188 ítems, 216 combos y 7 monedas |

El orden importa: el archivo 2 usa tablas que crea el 1, y así sucesivamente. Si algún
`Run` da error, **no sigas al siguiente** — resuelve ese primero.

**Comprobación.** En una consulta nueva, ejecuta:

```sql
select count(*) as items from checklist_items;   -- debe dar 188
select count(*) as combos from item_satisfied_by; -- debe dar 216
```

## Paso 5 · Conectar Netlify al repositorio

1. Entra a [netlify.com](https://netlify.com) y crea la cuenta con **GitHub**.
2. **Add new site → Import an existing project → GitHub**.
3. Autoriza el acceso y elige el repositorio **`Booklock/BitacoraDeMama`**.
4. Netlify detecta Next.js solo y lee `netlify.toml`. No cambies el comando de build
   ni la carpeta de publicación: ya vienen configurados.
5. **Antes de pulsar Deploy**, abre **Add environment variables** y añade las dos del
   paso 3:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | la Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la llave anon |

   Si ya pulsaste Deploy sin ellas, no pasa nada: añádelas en
   **Site configuration → Environment variables** y luego **Deploys → Trigger deploy →
   Deploy site** para que el sitio se reconstruya con las variables cargadas.
6. **Deploy**. El primer build tarda dos o tres minutos.

## Paso 6 · Comprobar que está viva

Abre la URL que te da Netlify (algo como `bitacora-de-mama.netlify.app`). Deberías ver
la portada y, en el recuadro de diagnóstico, **«Todo listo»** con el recuento de
categorías, ítems y monedas.

Si dice otra cosa, el propio recuadro indica a qué paso volver.

## Paso 7 · Decirle a Supabase cuál es la URL del sitio

Hay que hacerlo **después** de conocer la URL de Netlify, porque hasta ahora no existía.
Sin esto, los enlaces de recuperación de contraseña apuntarían a `localhost`.

1. En Supabase: **Authentication → URL Configuration**.
2. **Site URL**: la URL de Netlify.
3. En **Redirect URLs** añade también `https://TU-SITIO.netlify.app/**`.
4. **Save**.

---

## Desarrollo en local (opcional)

```bash
npm install
cp .env.example .env.local     # y rellena las dos variables del paso 3
npm run dev                    # http://localhost:3000
```

Comprobaciones antes de subir cambios:

```bash
npm run typecheck
npm run lint
npm run build
```

## Cómo se despliega a partir de ahora

Netlify queda enganchado al repositorio:

- Cada push a la rama principal publica el sitio.
- Cada Pull Request genera una **Deploy Preview** con su propia URL, útil para que tu
  prima revise cambios antes de que lleguen a producción.

## Si algo falla

| Síntoma | Causa habitual |
|---------|----------------|
| «Falta conectar Supabase» tras cargar las variables | El sitio no se reconstruyó. Trigger deploy en Netlify. |
| «Base conectada, catálogo vacío» | Falta ejecutar el archivo 4 del paso 4. |
| «No se pudo consultar la base» | Llave mal copiada (suele sobrar un espacio), o falta el archivo 3. |
| El build falla en Netlify | Mira el log completo del deploy; casi siempre es un error de tipos que también aparece con `npm run build` en local. |
| Un `Run` del paso 4 da error de tabla inexistente | Se ejecutaron en desorden. Empieza de nuevo por el archivo 1. |

## Sobre volver a ejecutar las migraciones

Los cuatro archivos se pueden ejecutar de nuevo sin miedo a duplicar datos: la semilla
usa `on conflict do nothing`. Lo que **no** es repetible es el archivo 1, porque crea
tablas y tipos que ya existirían. Si necesitas empezar de cero, es más limpio crear un
proyecto nuevo en Supabase que intentar limpiar el existente.
