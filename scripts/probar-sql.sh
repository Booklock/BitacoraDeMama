#!/usr/bin/env bash
# Levanta un Postgres desechable, instala el esquema completo y ejecuta las
# pruebas de seguridad. Sirve para comprobar el modelo de aislamiento entre
# familias sin tocar el Supabase de producción.
#
#   ./scripts/probar-sql.sh
#
# Requiere postgresql-16 instalado (initdb, pg_ctl, psql).
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGDATA=${PGDATA:-/var/tmp/pgdata-bitacora}
PGSOCK=${PGSOCK:-/var/tmp/pgsock}
PGPORT=${PGPORT:-55432}
export PATH="$PGBIN:$PATH"

limpiar() {
  pg_ctl -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true
  # Por si quedó uno huérfano de una ejecución anterior con este mismo PGDATA.
  pkill -f "postgres.*$PGDATA" >/dev/null 2>&1 || true
}
trap limpiar EXIT

echo "→ Preparando Postgres desechable en $PGDATA"
limpiar
rm -rf "$PGDATA"
mkdir -p "$PGDATA" "$PGSOCK"

# initdb se niega a correr como root, así que se usa el usuario postgres.
if [ "$(id -u)" -eq 0 ]; then
  chown -R postgres "$PGDATA" "$PGSOCK"
  CORRER="su postgres -c"
else
  CORRER="bash -c"
fi

$CORRER "PATH=$PGBIN:\$PATH initdb -D $PGDATA -A trust -U postgres" >/dev/null
$CORRER "PATH=$PGBIN:\$PATH pg_ctl -D $PGDATA -l $PGDATA/log -o \"-k $PGSOCK -p $PGPORT -c listen_addresses=''\" -w start" >/dev/null

PSQL="psql -h $PGSOCK -p $PGPORT -U postgres -v ON_ERROR_STOP=1"

echo "→ Creando la base"
$PSQL -q -c "create database bitacora;"

echo "→ Simulando el entorno de Supabase (auth.users, auth.uid, roles)"
$PSQL -d bitacora -q -f supabase/pruebas/00-entorno-supabase.sql

echo "→ Instalando el esquema completo"
$PSQL -d bitacora -q -f supabase/instalacion-completa.sql >/dev/null

# El instalador se ejecuta DOS veces: quien añade una migración vuelve a
# pegarlo entero sobre una base que ya tiene las anteriores, y antes eso
# reventaba en el primer "create type ... already exists".
echo "→ Reinstalando encima (debe ser idempotente)"
$PSQL -d bitacora -q -f supabase/instalacion-completa.sql >/dev/null

echo "→ Comprobando la semilla del catálogo"
$PSQL -d bitacora -q -c "
do \$\$ begin
  if (select count(*) from qrh_categories)    <> 13  then raise exception 'categorías incorrectas'; end if;
  if (select count(*) from checklist_items)   <> 188 then raise exception 'ítems incorrectos'; end if;
  if (select count(*) from item_satisfied_by) <> 216 then raise exception 'combos incorrectos'; end if;
  if (select count(*) from fx_rates)          <> 7   then raise exception 'monedas incorrectas'; end if;
  raise notice 'OK · 13 categorías, 188 ítems, 216 combos, 7 monedas';
end \$\$;"

echo "→ Pruebas de seguridad"
for prueba in supabase/pruebas/0[1-9]-*.sql; do
  echo "   · $(basename "$prueba")"
  $PSQL -d bitacora -f "$prueba" 2>&1 | grep -E "NOTICE|FALLO|ERROR|PASARON" | sed 's/^NOTICE:  /     /'
done

echo ""
echo "✓ Todo correcto"
