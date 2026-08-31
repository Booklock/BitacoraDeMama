# 01 · Análisis del Excel `Bitacora_de_Mama_Template.xlsx`

Documento de referencia técnica. Todo lo aquí descrito fue extraído directamente
del archivo (fórmulas, validaciones, formatos condicionales, gráficos y estilos),
no de suposiciones.

**Metadatos del archivo**
- Título: `Bitácora de Mamá — Inventory Management System`
- Autor: Bitácora de Mamá · Revisión 29 · Modificado 2026-07-22
- Libro protegido con contraseña y `lockStructure="1"`; las 6 hojas están protegidas.

## 1. Estructura del libro

| # | Hoja | Estado | Rol | ¿Editable por la usuaria? |
|---|------|--------|-----|---------------------------|
| 1 | `Bienvenida` | visible | Onboarding / instrucciones estáticas | No |
| 2 | `Configuración` | visible | Ajustes: moneda, personas, datos del bebé | **Sí** |
| 3 | `Dashboard` | visible | KPIs y 4 gráficos, 100 % derivado | No |
| 4 | `Inventory` | visible | Registro de productos — única hoja de captura | **Sí** |
| 5 | `Reference` | **oculta** | Catálogo maestro (13 QRH × 188 ítems) | No |
| 6 | `QRH Checklists` | visible | 13 checklists, casi todo derivado | Parcial (`N/A`, `Qty Needed`, `Notas`, y 2 checklists manuales) |

**Flujo de datos real:**

```
Configuración ──► (moneda, tasas, nombres, bebé)
                        │
Reference ──► catálogo ─┤
                        ▼
                   Inventory  ← ÚNICA entrada de datos
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
   QRH Checklists                 Dashboard
   (se marcan solos)          (KPIs + 4 gráficos)
```

## 2. Hoja `Reference` (catálogo maestro, oculta)

Es el corazón del modelo. Columnas:

- `A:D` → tabla de las 13 categorías QRH: `QRH_ID`, `Name_EN`, `Name_ES`, `Display`
  (donde `Display = "Name_EN | Name_ES"`, p. ej. `Nursery | Cuarto del bebé`).
- `F:R` → 13 columnas, una por QRH, con los nombres de sus ítems. Cada columna está
  expuesta como **rango con nombre** `QRH_001` … `QRH_013` (definidos en el libro).
  Esto es lo que alimenta el desplegable en cascada de `Inventory`.
- `T:U` → tabla de resolución: `Key (QRH_ID|Display)` → `Item_ID`
  (p. ej. `QRH-001|Crib | Cuna` → `QRH-001-01`). 188 filas.

**Verificado:** los 188 `Item_ID` de `Reference!U` coinciden exactamente con los 188
ítems de `QRH Checklists` — sin huérfanos ni duplicados en ninguna dirección.

### Inventario de categorías

| QRH_ID | Name_EN | Name_ES | Ítems | Modo |
|--------|---------|---------|-------|------|
| QRH-001 | Nursery | Cuarto del bebé | 22 | automático |
| QRH-002 | Wardrobe | Ropa del bebé | 38 | automático |
| QRH-003 | Bath Time | Hora del baño | 12 | automático |
| QRH-004 | Breastfeeding | Lactancia | 12 | automático |
| QRH-005 | Feeding | Alimentación | 14 | automático |
| QRH-006 | Medical Appointments | Citas médicas | 10 | automático |
| QRH-007 | Hospital Bag - Baby | Maleta del bebé | 11 | **manual** |
| QRH-008 | Mom & Dad Bag | Maleta de mamá y papá | 13 | automático |
| QRH-009 | Mom Recovery | Recuperación postparto | 13 | automático |
| QRH-010 | Pregnancy Amenity Kit | Kit de bienestar para el embarazo | 13 | automático |
| QRH-011 | On the Go | Salidas y transporte | 11 | automático |
| QRH-012 | Landing | Llegada a casa | 9 | **manual** |
| QRH-013 | Baby Care | Cuidado del bebé | 10 | automático |
| | | **Total** | **188** | |

El catálogo completo, ya normalizado, está en
[`data/seed/qrh-catalog.json`](../data/seed/qrh-catalog.json).

## 3. Hoja `Configuración`

| Celda | Contenido | Uso |
|-------|-----------|-----|
| `C5` | Moneda elegida (lista desplegable `B8:B15`) | moneda principal |
| `C6` | Símbolo libre si eligió «Otra» | |
| `E6` | Tasa a USD si eligió «Otra» | |
| `B8:E15` | Tabla de 7 monedas + «Otra»: etiqueta, símbolo, código, tasa a USD | |
| `C17` | `=IF(C5="Otra…",C6,INDEX(C8:C15,MATCH(C5,B8:B15,0)))` | símbolo activo |
| `H17` | Código de moneda activo | |
| `J17` | Tasa de la moneda activa a USD | divisor de la conversión |
| `C22:C28` | 7 nombres de pagadores (4 por defecto + 3 libres) | desplegable «Purchased By» |
| `C34:C36` | Nombre del bebé, apellido paterno, apellido materno | Flight Plan |
| `C38` | `Mission ID` (fórmula, ver §6.5) | encabezado del Dashboard |

Monedas incluidas: EUR (1.144), USD (1), CRC (0.0022), MXN (0.0575), GTQ (0.1311),
COP (0.000303), ARS (0.000671), más «Otra» con tasa manual.
Valores exactos en [`data/seed/config-defaults.json`](../data/seed/config-defaults.json).

## 4. Hoja `Inventory` (única entrada de datos)

Cabeceras en la fila 3, datos en `A4:P210` (**207 filas máximo**, límite duro del Excel).
`autoFilter A3:J203`, panel congelado en `A4`.

| Col | Campo | Tipo | Notas |
|-----|-------|------|-------|
| A | Product Name | texto libre | |
| B | QRH Category | **lista** `$T$1:$T$13` (los 13 `Display`) | |
| C | Checklist Item | **lista en cascada** `INDIRECT(SUBSTITUTE($O4,"-","_"))` | depende de B vía `O` |
| D | Brand | texto | |
| E | Store | texto | |
| F | URL | texto | |
| G | Price | número | en la moneda de la columna H |
| H | Currency | lista `EUR,USD,CRC,MXN,GTQ,COP,ARS,Otra` | |
| I | Converted Price | **fórmula bloqueada** | ver §6.1 |
| J | Qty | número | se suma en el checklist |
| K | Status | lista `Purchased,Pending,Wishlist,Savings` | |
| L | Purchased By | lista `$R$1:$R$7` (espejo de `Configuración!C22:C28`) | |
| M | Notas | texto | |
| N | Stage | lista `Pregnancy,0-3,3-6,6-9,9-12 Months,All Stages` | |
| O | `qrh_id` | fórmula (oculta) | `Display` → `QRH-0xx` |
| P | `item_id` | fórmula (oculta) | `qrh_id\|Display` → `QRH-0xx-yy` |

Columnas auxiliares: `R1:R7` = espejo de los nombres de pagadores;
`T1:T13` = espejo de los `Display` de las 13 categorías.

**Formato condicional (colores de estado):**

| Regla | Color |
|-------|-------|
| `K = "Purchased"` | `#DADC7C` |
| `K = "Pending"` | `#F2EDB9` |
| `K = "Wishlist"` | `#BEE4ED` |
| `K = "Savings"` | `#8ACCE0` |
| `AND($K="Savings", $L<>"Regalo (Baby Shower)")` → resalta `L` | `#F8D7A4` |

La última regla es una **alerta de coherencia**: si algo está en «Savings» (ahorro
para regalo) pero el pagador no es «Regalo (Baby Shower)», se marca en naranja.

## 5. Hoja `QRH Checklists`

242 filas. Patrón repetido por cada QRH:

```
fila N     → encabezado  "QRH-00X   Name_EN | Name_ES"   (merge A:G)
fila N+1   → descripción                                  (merge A:G)
fila N+2   → cabeceras: A(id) B(Checklist Item) C(Completed) D(Qty Needed) E(Cantidad) F(N/A) G(Notas)
filas N+3… → ítems
```

Rangos exactos de ítems por QRH (los usa el Dashboard para calcular progreso):

| QRH | Filas | QRH | Filas |
|-----|-------|-----|-------|
| 001 | 7–28 | 008 | 154–166 |
| 002 | 33–70 | 009 | 171–183 |
| 003 | 75–86 | 010 | 188–200 |
| 004 | 91–102 | 011 | 205–215 |
| 005 | 107–120 | 012 | 220–228 |
| 006 | 125–134 | 013 | 233–242 |
| 007 | 139–149 | | |

- `C` (Completed) es fórmula en 11 de los 13 QRH. En **QRH-007** y **QRH-012** es una
  lista manual `Yes,No` (el propio Excel lo explica: no siempre corresponden a una compra).
- `F` (N/A) es una lista con un único valor `"N/A"` → sirve para excluir un ítem.
- `D` (Qty Needed) es editable, por defecto `1`.
- `E` (Cantidad) muestra `comprado/necesario` o `N/A`.
- Formato condicional: fila completa en gris `#E3E3E3` cuando `C = "Yes"`.

## 6. Fórmulas — semántica exacta a replicar

### 6.1 Precio convertido (`Inventory!I`)
```excel
=IFERROR(IF(G="","",IF(H="",G,
   ROUND(G * IF(H="Otra", Configuración!$E$6,
                IFERROR(INDEX(Configuración!$E$8:$E$14, MATCH(H, Configuración!$D$8:$D$14,0)),1))
           / Configuración!$J$17, 2))),"")
```
En pseudocódigo: `convertido = round(precio × tasa_a_usd(moneda_compra) / tasa_a_usd(moneda_principal), 2)`.
Si no hay precio → vacío. Si no hay moneda → se toma el precio tal cual. Moneda desconocida → tasa 1.

### 6.2 Resolución de IDs (`Inventory!O` y `P`)
```excel
O = INDEX(Reference!A2:A14, MATCH(B, Reference!D2:D14, 0))          -- Display → qrh_id
P = INDEX(Reference!U2:U189, MATCH(O & "|" & C, Reference!T2:T189, 0))  -- clave compuesta → item_id
```

### 6.3 Ítem completado (`QRH Checklists!C`) — **la regla central**
```excel
= IF(OR( $F = "N/A",
         ( Σ SUMIFS(Inventory.Qty; qrh_id=Q; item_id=I; status="Purchased")
         + Σ SUMIFS(Inventory.Qty; qrh_id=Q; item_id=I; status="Savings") )
         >= MAX(D,1) ),
    "Yes","No")
```
Tres detalles que **no** son obvios:

1. **Cuenta cantidades, no productos.** Suma `Qty`, no filas. Con `Qty Needed = 3`,
   una sola fila con `Qty = 3` completa el ítem.
2. **`Savings` cuenta como completado**, igual que `Purchased`. `Pending` y `Wishlist` no.
3. **Ítems «combo» satisfacen a sus componentes.** Varias fórmulas suman términos de
   *otros* `item_id`. Ejemplo `QRH-001-06` (Baby Monitor) también se completa con
   `QRH-001-07` (Monitor + Termómetro). Hay **28 ítems** con fuentes adicionales, e
   incluso un caso **entre categorías**: `QRH-001-14` (Changing Table) se completa
   con `QRH-003-03` (Set de Baño, que incluye cambiador).

El mapa completo está en el campo `satisfied_by` de cada ítem en
[`qrh-catalog.json`](../data/seed/qrh-catalog.json).

### 6.4 Dashboard
```excel
Progreso global   = COUNTIF(checklists.C,"Yes") / COUNTA(checklists.C)          -- sobre 188
Gasto total       = SUM(Inventory.I)                                            -- ⚠ sin filtrar estado
Gasto por QRH     = SUMIFS(Inventory.I; qrh_id = "QRH-00X")                     -- ⚠ sin filtrar estado
Progreso por QRH  = COUNTIF(rango_C_del_QRH,"Yes") / COUNTA(rango_C_del_QRH)
Total por pagador = SUMIFS(Inventory.I; Purchased By = nombre)
Ahorros           = SUMIFS(Inventory.I; Status = "Savings")
% por etapa       = COUNTIFS(Stage=E; Status="Purchased") / COUNTIF(Stage=E)
```

### 6.5 Mission ID (`Configuración!C38`)
```excel
= UPPER(LEFT(sin_acentos(nombre_bebé), 4)) & "001-QRH"
```
Sustituye á é í ó ú, toma las 4 primeras letras y las pasa a mayúsculas.

### 6.6 Flight Plan (encabezado del Dashboard)
`AIRCRAFT` = `apellido_padre-apellido_madre Family` · `CAPTAIN` = madre ·
`FIRST OFFICER` = padre · `PASSENGER` = bebé · `MISSION` = `Safe Delivery <bebé>` ·
`FLIGHT DURATION` = `9 months`.

## 7. Gráficos del Dashboard

Cuatro gráficos de barras:

| Gráfico | Datos | Categorías |
|---------|-------|------------|
| Progreso por QRH | `D23:D35` (%) | 13 QRH |
| Gasto por QRH | `C23:C35` (moneda) | 13 QRH |
| ¿Quién paga? | `C53:C60` | 7 pagadores + Savings |
| Completado por etapa | `C73:C78` (%) | 6 etapas |

## 8. Marca y estilo

- **Tipografía:** Poppins en todo el libro.
- **Texto:** `#1F1F1F` / `#1A1A1A`, secundario `#6B6B63`.
- **Paleta extraída:**

| Uso | Color |
|-----|-------|
| Verde principal | `#33A372` / `#30A472` |
| Verde claro | `#4BC490` |
| Amarillo marca | `#F0D02B` |
| Amarillo suave / filas | `#FDF3BA`, `#F2EDB9`, `#EFF0B1` |
| Oliva (Purchased) | `#DADC7C` |
| Azul cielo | `#A5DAE6`, `#BEE4ED`, `#E4F3F8` |
| Azul (Savings) | `#8ACCE0` |
| Naranja (alerta) | `#F8D7A4` |
| Neutros | `#F4F2E9`, `#F1EDEA`, `#EDE5DF`, `#E3E3E3` |

- **Assets:** isotipo (madre y bebé) e ilustración de caja con productos, ambos
  extraídos a [`assets/brand/`](../assets/brand/).
- **Voz de marca:** metáfora de aviación — «Diario de vuelo», QRH (*Quick Reference
  Handbook*), Flight Plan, Mission. Etiquetas bilingües `EN | ES` en todo el catálogo.
- **Tagline:** *«Not just checklists — flight procedures for the most important journey of your life.»*

## 9. Hallazgos que exigen una decisión de producto

Estos son comportamientos reales del Excel que conviene decidir si se replican tal cual
o se corrigen en la web. Ninguno bloquea el desarrollo; los listo para que decidan.

1. **El «Budget Total Gastado» suma todo, incluidos `Pending` y `Wishlist`.** El KPI
   no filtra por estado, así que una lista de deseos infla el gasto. Lo mismo aplica al
   gasto por QRH y por pagador. → En la web propongo mostrar *Gastado* (Purchased+Savings)
   y *Proyectado* (todo) por separado, manteniendo el número del Excel visible.
2. **`Qty` no multiplica el precio.** `Converted Price` es precio unitario aunque `Qty = 3`.
   El Dashboard suma unitarios. Es probablemente un bug del Excel.
3. **Límite de 207 filas de inventario y 188 ítems fijos.** En la web desaparece el
   límite, y el catálogo puede volverse extensible (ítems propios de la usuaria).
4. **Cada QRH tiene un ítem genérico «Other | Otro»** que cuenta para el porcentaje de
   avance; nunca se completará solo salvo que se le asigne una compra.
5. **Los ítems combo cuentan dos veces en el avance**: comprar el «Set de Baño» marca
   4 ítems del checklist, lo cual es intencional y hay que preservarlo.
6. **`Reference` está oculta y el libro protegido con contraseña**: la intención de la
   marca es que el catálogo no se toque. En la web equivale a: catálogo del sistema,
   no editable por la usuaria (salvo que decidamos permitir ítems propios).
