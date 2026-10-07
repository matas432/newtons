# Newtons

Suplementos suizos seleccionados, conocimiento estructurado y una app para
organizarlos, en una sola experiencia.
*La diferencia no termina en el producto. Continúa en lo que Newtons permite hacer con él.*

Prototipo (etapa B) con datos ficticios. Las decisiones de producto están en
los documentos internos *Libro 1 v2.0 — Nueva dirección* y la *Plantilla de
ficha Newtons* (no incluidos en este repositorio). El prototipo anterior para
droguerías se conserva en la etiqueta `b2b-drugstore-prototype`.

## Stack

- **Next.js 16** + **Payload CMS 3** (TypeScript), en una sola aplicación.
- **PostgreSQL 17** (Docker).
- Newtons es la única fuente de verdad para productos, clientes, pedidos,
  inventario y conocimiento. El proveedor de pago (Stripe o Payrexx, por
  decidir) solo cobrará; en la demo el pago es simulado.

## Puesta en marcha

```bash
cp .env.example .env          # y cambia PAYLOAD_SECRET
docker compose up -d          # PostgreSQL en 127.0.0.1:5433
pnpm install
pnpm seed                     # borra y crea los datos de la demo
pnpm dev                      # http://localhost:3100
```

Panel: <http://localhost:3100/admin>. Todas las cuentas demo usan la
contraseña `demo-newtons` (solo para desarrollo local):

| Cuenta | Rol |
|---|---|
| `admin@newtons.test` | Administración técnica |
| `editor@newtons.test` | Editorial (fichas, productos) |
| `revision@newtons.test` | Revisión profesional (aprueba fichas, pool y composiciones) |
| `operaciones@newtons.test` | Operaciones (pedidos, lotes, stock, envíos) |
| `soporte@newtons.test` | Soporte (pedidos y cuentas, sin seguimiento) |
| `anna@demo.test` | Cliente (API; la app del cliente es el siguiente paso) |

### Fichas privadas

El contenido editorial no está publicado y no se sube a este repositorio. Si
existe `seed-data/private/*.json` (ignorado por git), `pnpm seed` carga esas
fichas además de la ficha ficticia de `seed-data/example/`.

## Recorrido

conocer → comprar → recibir → organizar → registrar → revisar.
El pedido no es una pauta. La recepción no inicia un ciclo. Una compra
repetida no equivale a una decisión de continuar.

## Modelo de datos

| Grupo | Colecciones |
|---|---|
| Conocimiento | `ingredients` (ficha + estado en el pool), `domains`, `rhythms`, `blocks`, `sources` |
| Catálogo | `products` (datos comerciales, origen, venta), `formulations` (composición versionada; una verificada no se modifica), `suppliers`, `product-submissions` (productos comprados en otro lugar) |
| Inventario | `lots` (lote, caducidad, retención), `stock-movements` (libro de movimientos, solo se añade) |
| Pedidos | `orders`, `payment-events` (un evento se procesa una sola vez), global `shop-settings` |
| Seguimiento del cliente | `customers`, `consents`, `customer-products` («Mis productos»), `plans`, `plan-items`, `intake-logs`, `reviews`, `symptom-reports` |
| Sistema | `users` (equipo), `audit-log`, `media`, `private-files` |

Reglas principales:

- **Pool:** solo se verifica una composición, se vende un producto o se añade
  a «Mis productos» si todos sus ingredientes funcionales están en el pool.
  Un producto externo con un ingrediente no cubierto queda como solicitud de
  ampliación del catálogo.
- **Tres cosas separadas:** información verificada del producto (incluida la
  etiqueta, como referencia), el plan que declara el cliente y la revisión
  profesional (estado aparte, por defecto «sin revisión profesional»). El
  sistema no recomienda ni ajusta cantidades.
- **Pedidos:** precios e IVA calculados en el servidor; la compra no se
  reescribe desde el panel; el lote se asigna al empaquetar (vencimiento más
  próximo, nunca retenidos ni con vida útil insuficiente); enviado exige
  seguimiento y fecha de depósito; las devoluciones entran como retenidas.
- **Privacidad:** el seguimiento (productos registrados, plan, tomas,
  revisiones, molestias) solo lo ve el propio cliente. Operaciones ve pedidos
  y direcciones; editorial verifica productos enviados sin ver quién los envió.

Lógica de dominio en funciones puras (`src/lib`):

- `schedule.ts` — ciclos, fases, revisiones y tomas programadas.
- `doses.ts` — suma por día de cada ingrediente: programado frente a
  confirmado, solo composiciones verificadas, sin convertir unidades.
- `inventory.ts` — stock por lote, disponible para vender, asignación FEFO.
- `money.ts` — importes en céntimos e IVA incluido.

Servicios con base de datos (`src/commerce`): `checkout.ts`, `payments.ts`,
`stock.ts`. Endpoints: `POST /api/orders/checkout` y
`POST /api/orders/:id/simulate-payment` (solo con `SIMULATED_PAYMENTS=true`).

## Idiomas

Contenido en español (idioma editorial interno), alemán (principal para
clientes) e inglés (secundario). Francés e italiano se añaden en
`src/payload.config.ts`. Sin relleno entre idiomas: un idioma no aprobado no
se muestra.

## Pruebas

```bash
pnpm test:unit   # calendario, dosis, inventario, importes
pnpm test:int    # pruebas de aceptación del Libro 1 v2.0, cap. 15 (base newtons_test)
pnpm test        # ambas
```

Las pruebas de integración necesitan la base `newtons_test`:

```bash
docker compose exec postgres psql -U newtons -c "create database newtons_test"
```

## Estado

Hecho: modelo de datos para venta directa, catálogo con pool, inventario por
lotes, pedidos con pago simulado e idempotente, «Mis productos», plan
declarado por el cliente, revisiones y permisos.

Siguiente: app web del cliente en alemán e inglés (producto → carrito → pago
simulado → cuenta → Mis productos → plan → Hoy → registro → revisión), panel
de operaciones para empaquetar y enviar, y web pública.

Fuera del prototipo: pagos reales, apps nativas, alertas clínicas
personalizadas, cuentas familiares y automatización de etiquetas postales.
