# Newtons

Plataforma de información y acompañamiento de suplementos para droguerías.
*El asesoramiento continúa en casa.*

Prototipo en construcción, con datos ficticios. Las decisiones de producto
están en los documentos internos *Libro 1 — Documento fundacional*,
*Libro 2 — Decisiones y plan piloto* y *Plantilla de ficha Newtons* (no
incluidos en este repositorio).

## Stack

- **Next.js 16** + **Payload CMS 3** (TypeScript), en una sola aplicación.
- **PostgreSQL 17** (Docker).
- Panel de administración de Payload = panel editorial, de cadena y de
  droguería. La app del cliente y los paneles propios se construyen como
  páginas de Next.js sobre la misma base de datos.

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
| `admin@newtons.test` | Administración Newtons |
| `editor@newtons.test` | Editorial (crea y edita fichas) |
| `revision@newtons.test` | Revisión profesional (aprueba fichas, verifica composiciones) |
| `cadena@sonnenberg.test` | Administración de la cadena (sin acceso a datos de salud) |
| `mostrador@sonnenberg.test` | Personal: invitaciones y preparación de planes |
| `profesional@sonnenberg.test` | Personal: prepara, confirma y revisa planes |
| `ana@demo.test` | Cliente (API; la app del cliente aún no existe) |

### Fichas privadas

El contenido MAT no está publicado y no se sube a este repositorio. Si existe
`seed-data/private/*.json` (ignorado por git), `pnpm seed` carga esas fichas.
Si no, carga la ficha ficticia de `seed-data/example/`.

## Modelo de datos

Tres niveles separados: **sustancia** (ficha) → **producto comercial**
(con formulaciones versionadas) → **plan personal**.

| Grupo | Colecciones |
|---|---|
| Conocimiento | `ingredients` (ficha, grupos A–H de la plantilla), `domains` (DF-1…DF-7), `rhythms` (Río, Terreno, Cultivo, Cosecha), `blocks`, `sources` |
| Catálogo | `products`, `formulations` (composición versionada; una verificada no se modifica) |
| Droguerías | `chains`, `stores`, `assortment`, `users` (personal y roles) |
| Clientes y planes | `customers` (cuenta Newtons), `customer-links`, `invitations`, `consents`, `plans`, `plan-items`, `intake-logs`, `reviews`, `symptom-reports` |
| Sistema | `audit-log`, `media` |

Lógica de dominio en funciones puras:

- `src/lib/schedule.ts` — ciclos, fases, revisiones y tomas programadas. Sin
  renovación automática; una pausa no alarga el ciclo; el uso selectivo no
  programa tomas.
- `src/lib/doses.ts` — suma por día de cada ingrediente: programado frente a
  confirmado, solo formulaciones verificadas, sin convertir unidades y
  avisando cuando el resultado está incompleto.

### Reglas de acceso (`src/access`)

- Los datos de salud solo los ven el propio cliente y el personal con el
  permiso correspondiente, dentro de su cadena y sus establecimientos. La
  administración de la cadena no los ve.
- Solo la revisión profesional aprueba fichas y verifica composiciones.
- Los cambios en planes activos exigen motivo y quedan en `audit-log`
  (quién, cuándo, qué campos y por qué, sin copiar valores).

## Pruebas

```bash
pnpm test:unit   # calendario y sumas de dosis
pnpm test:int    # permisos y trazabilidad (base de datos newtons_test)
pnpm test        # ambas
```

Las pruebas de integración necesitan la base `newtons_test`:

```bash
docker compose exec postgres psql -U newtons -c "create database newtons_test"
```

## Estado

Hecho: modelo de datos, panel editorial, permisos, motor de calendario,
sumas de dosis y datos de demo.

Siguiente: panel de droguería (invitar, crear y confirmar planes), app web
del cliente (plan de hoy, calendario, registro de tomas, revisión) y web
pública.

Fuera del prototipo (Libro 2): apps nativas, alertas clínicas
personalizadas, integraciones, stock y reposición.
