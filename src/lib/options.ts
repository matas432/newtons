/** Listas de opciones compartidas por varias colecciones. */

export const EDITORIAL_STATUS = [
  { label: 'Borrador', value: 'draft' },
  { label: 'En revisión', value: 'in-review' },
  { label: 'Aprobada', value: 'approved' },
  { label: 'Histórica', value: 'historical' },
  { label: 'Retirada', value: 'retired' },
]

export const TRANSLATION_STATUS = [
  { label: 'No iniciada', value: 'not-started' },
  { label: 'Borrador', value: 'draft' },
  { label: 'Revisada', value: 'reviewed' },
  { label: 'Aprobada', value: 'approved' },
]

/** Libro 2, n.º 14: Sí/No no basta; también «no evaluado» e «información insuficiente». */
export const SIGNAL_STATUS = [
  { label: 'Sí', value: 'yes' },
  { label: 'No', value: 'no' },
  { label: 'No evaluado', value: 'not-evaluated' },
  { label: 'Información insuficiente', value: 'insufficient' },
]

export const SEVERITY = [
  { label: 'Baja', value: 'low' },
  { label: 'Moderada', value: 'moderate' },
  { label: 'Alta', value: 'high' },
]

export const EVIDENCE_LEVEL = [
  { label: 'Teórica', value: 'theoretical' },
  { label: 'Preclínica / in vitro', value: 'preclinical' },
  { label: 'Casos aislados', value: 'case-reports' },
  { label: 'Humana limitada', value: 'human-limited' },
  { label: 'Humana consistente', value: 'human-consistent' },
  { label: 'Establecida', value: 'established' },
]

export const CLAIM_CLASSIFICATION = [
  { label: 'Establecida', value: 'established' },
  { label: 'Posible', value: 'possible' },
  { label: 'Exploratoria', value: 'exploratory' },
  { label: 'Uso tradicional', value: 'traditional-use' },
]

export const AMOUNT_UNITS = [
  { label: 'mg', value: 'mg' },
  { label: 'µg', value: 'ug' },
  { label: 'g', value: 'g' },
  { label: 'UI', value: 'IU' },
  { label: 'ml', value: 'ml' },
  { label: 'UFC', value: 'CFU' },
]

/** A qué se refiere una cantidad: evita sumar extracto con elemento, etc. */
export const AMOUNT_BASIS = [
  { label: 'Extracto', value: 'extract' },
  { label: 'Elemento (p. ej. magnesio elemental)', value: 'elemental' },
  { label: 'Compuesto (p. ej. citrato de magnesio)', value: 'compound' },
  { label: 'Sustancia activa', value: 'active' },
  { label: 'Mezcla sin desglose', value: 'blend' },
]

export const MEAL_RELATION = [
  { label: 'En ayunas', value: 'fasting' },
  { label: 'Con comida', value: 'with-food' },
  { label: 'Indiferente', value: 'any' },
]

export const REVIEW_OUTCOMES = [
  { label: 'Continuar', value: 'continue' },
  { label: 'Ajustar con el profesional', value: 'adjust' },
  { label: 'Otro ciclo', value: 'new-cycle' },
  { label: 'Simplificar', value: 'simplify' },
  { label: 'Pausar', value: 'pause' },
  { label: 'Retirar', value: 'withdraw' },
  { label: 'Derivar para otra valoración', value: 'refer' },
]

export const OBSERVATION_ANSWER_TYPES = [
  { label: 'Sí / No', value: 'yes-no' },
  { label: 'Escala 1–5', value: 'scale' },
  { label: 'Texto libre', value: 'text' },
]

export const WEEKDAYS = [
  { label: 'Lunes', value: 'mon' },
  { label: 'Martes', value: 'tue' },
  { label: 'Miércoles', value: 'wed' },
  { label: 'Jueves', value: 'thu' },
  { label: 'Viernes', value: 'fri' },
  { label: 'Sábado', value: 'sat' },
  { label: 'Domingo', value: 'sun' },
]
