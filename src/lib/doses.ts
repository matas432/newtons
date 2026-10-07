/**
 * Suma de ingredientes por día concreto (Libro 1, cap. 8; Libro 2, n.º 12 y 28).
 *
 * - Suma solo cantidades de formulaciones verificadas.
 * - No convierte unidades ni formas: agrupa por ingrediente + unidad + base.
 * - No desglosa mezclas: una cantidad «blend» no se atribuye a componentes.
 * - Separa cantidad programada y cantidad confirmada como tomada.
 * - Nunca declara seguridad: si falta algo, el resultado es incompleto y lo dice.
 */

export interface CompositionRow {
  ingredientId: string | number
  amount: number | null | undefined
  unit: string | null | undefined
  basis: string | null | undefined
}

export interface DoseLine {
  planItemId: string | number
  productName: string
  /** Unidades programadas ese día (suma de las tomas declaradas de la línea). */
  servingsPerDay: number
  /** La línea tiene tomas programadas ese día. */
  scheduled: boolean
  formulationVerified: boolean
  composition: CompositionRow[]
}

export interface IntakeRecord {
  planItemId: string | number
  status: 'taken' | 'skipped' | 'postponed'
  servings?: number | null
}

export interface IngredientTotal {
  ingredientId: string | number
  unit: string
  basis: string
  scheduled: number
  confirmed: number
}

export interface DailyTotals {
  totals: IngredientTotal[]
  /** Productos cuya composición no está verificada: no entran en la suma. */
  unverifiedProducts: string[]
  /** Componentes sin cantidad o unidad declarada, o mezclas sin desglose. */
  undeclared: Array<{ productName: string; ingredientId: string | number }>
  /** `true` solo si todo lo programado o tomado ese día está verificado y declarado. */
  complete: boolean
}

export function dailyTotals(lines: DoseLine[], intakes: IntakeRecord[]): DailyTotals {
  const totals = new Map<string, IngredientTotal>()
  const unverified = new Set<string>()
  const undeclared: DailyTotals['undeclared'] = []

  const takenServings = new Map<string, number>()
  for (const r of intakes) {
    if (r.status !== 'taken') continue
    const key = String(r.planItemId)
    takenServings.set(key, (takenServings.get(key) ?? 0) + (r.servings ?? 0))
  }

  for (const line of lines) {
    const taken = takenServings.get(String(line.planItemId)) ?? 0
    const scheduledServings = line.scheduled ? line.servingsPerDay : 0
    if (scheduledServings === 0 && taken === 0) continue

    if (!line.formulationVerified) {
      unverified.add(line.productName)
      continue
    }

    for (const row of line.composition) {
      if (row.amount == null || !row.unit || !row.basis || row.basis === 'blend') {
        undeclared.push({ productName: line.productName, ingredientId: row.ingredientId })
        continue
      }
      const key = `${row.ingredientId}|${row.unit}|${row.basis}`
      const total = totals.get(key) ?? { ingredientId: row.ingredientId, unit: row.unit, basis: row.basis, scheduled: 0, confirmed: 0 }
      total.scheduled += row.amount * scheduledServings
      total.confirmed += row.amount * taken
      totals.set(key, total)
    }
  }

  return {
    totals: [...totals.values()],
    unverifiedProducts: [...unverified],
    undeclared,
    complete: unverified.size === 0 && undeclared.length === 0,
  }
}
