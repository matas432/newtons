/**
 * Importes en céntimos enteros para evitar errores de coma flotante.
 * Los precios se introducen en CHF en el panel y se convierten aquí.
 */

export const toCents = (chf: number) => Math.round(chf * 100)

export interface PricedLine {
  unitPriceCents: number
  quantity: number
  /** IVA incluido en el precio, en %. */
  vatRate: number
}

export interface OrderTotals {
  subtotalCents: number
  shippingCents: number
  totalCents: number
  /** IVA contenido en el total (precios con IVA incluido). */
  vatCents: number
}

/**
 * Totales de un pedido con precios IVA incluido. El IVA del envío sigue el
 * tipo indicado (por defecto, el del primer artículo); confirmar con asesoría fiscal.
 */
export function orderTotals(lines: PricedLine[], shippingCents: number, shippingVatRate?: number): OrderTotals {
  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0)
  const vatOf = (gross: number, rate: number) => Math.round((gross * rate) / (100 + rate))
  const linesVat = lines.reduce((s, l) => s + vatOf(l.unitPriceCents * l.quantity, l.vatRate), 0)
  const shipRate = shippingVatRate ?? lines[0]?.vatRate ?? 0
  return {
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    vatCents: linesVat + vatOf(shippingCents, shipRate),
  }
}

export const formatCHF = (cents: number) => `CHF ${(cents / 100).toFixed(2)}`
