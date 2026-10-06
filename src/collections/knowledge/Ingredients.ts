import type { CollectionConfig, Field } from 'payload'

import { approvedOrStaff, editorial } from '@/access'
import { editorialWorkflow } from '@/hooks/editorialWorkflow'
import {
  AMOUNT_BASIS,
  AMOUNT_UNITS,
  CLAIM_CLASSIFICATION,
  EDITORIAL_STATUS,
  EVIDENCE_LEVEL,
  MEAL_RELATION,
  OBSERVATION_ANSWER_TYPES,
  REVIEW_OUTCOMES,
  SEVERITY,
  SIGNAL_STATUS,
  TRANSLATION_STATUS,
} from '@/lib/options'

/**
 * Ficha Newtons de una sustancia o ingrediente. La estructura sigue la
 * «Plantilla de ficha Newtons v0.1»: grupos A–H. Los textos marcados como
 * «C» los ve el cliente; «P», el personal; «E», solo el equipo editorial.
 */

const signalSummary = (name: string, label: string): Field => ({
  name,
  label,
  type: 'group',
  fields: [
    { name: 'status', label: 'Estado', type: 'select', required: true, defaultValue: 'not-evaluated', options: SIGNAL_STATUS },
    { name: 'text', label: 'Texto', type: 'textarea', localized: true },
  ],
  admin: { description: '«No» nunca se muestra como «sin riesgo». El detalle va en la lista correspondiente.' },
})

const AUDIENCE: Record<string, string> = {
  'C+': 'Lo ve el cliente en «Saber más»',
  C: 'Lo ve el cliente',
  P: 'Lo ve el personal de la droguería',
  E: 'Solo equipo editorial',
}

/** Descripción del campo: «C · texto» → «Lo ve el cliente · texto». */
const audience = (text: string) => {
  const [code, ...rest] = text.split(' · ')
  const who = AUDIENCE[code.trim()]
  return { description: who ? [who, ...rest].join(' · ') : text }
}

export const Ingredients: CollectionConfig = {
  slug: 'ingredients',
  labels: { singular: 'Ficha', plural: 'Fichas' },
  admin: {
    group: 'Conocimiento',
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'primaryDomain', 'editorialStatus', 'updatedAt'],
    listSearchableFields: ['name', 'scientificName'],
  },
  access: { read: approvedOrStaff, create: editorial, update: editorial, delete: editorial },
  versions: { maxPerDoc: 50 },
  hooks: { beforeChange: [editorialWorkflow] },
  fields: [
    {
      type: 'tabs',
      tabs: [
        // ------------------------------------------------------------ A
        {
          label: 'A · Identidad',
          fields: [
            { name: 'name', label: 'Nombre común', type: 'text', required: true, localized: true },
            { name: 'slug', label: 'Identificador', type: 'text', required: true, unique: true, index: true, admin: audience('Minúsculas y guiones, p. ej. «rhodiola». No cambia entre idiomas.') },
            { name: 'scientificName', label: 'Nombre científico o químico', type: 'text' },
            { name: 'otherNames', label: 'Otros nombres', type: 'array', labels: { singular: 'Nombre', plural: 'Nombres' }, admin: audience('E · búsqueda: sinónimos, nombres de etiqueta y de otros idiomas.'), fields: [{ name: 'value', label: 'Nombre', type: 'text', required: true }] },
            {
              name: 'category',
              label: 'Categoría',
              type: 'select',
              required: true,
              options: [
                { label: 'Vitamina', value: 'vitamin' },
                { label: 'Mineral', value: 'mineral' },
                { label: 'Aminoácido', value: 'amino-acid' },
                { label: 'Ácido graso', value: 'fatty-acid' },
                { label: 'Extracto vegetal', value: 'plant-extract' },
                { label: 'Hongo', value: 'fungus' },
                { label: 'Otro', value: 'other' },
              ],
            },
            { name: 'components', label: 'Componentes', type: 'relationship', relationTo: 'ingredients', hasMany: true, admin: audience('Solo para familias: omega-3 → EPA, DHA; complejo B → cada vitamina.') },
          ],
        },
        // ------------------------------------------------------------ B
        {
          label: 'B · Ficha breve',
          description: 'Lo que el cliente ve primero. Debe leerse en un minuto.',
          fields: [
            { name: 'summary', label: 'Resumen en una frase', type: 'text', localized: true, maxLength: 160, admin: audience('C · máx. 160 caracteres.') },
            { name: 'whatIsShort', label: 'Qué es (breve)', type: 'textarea', localized: true, maxLength: 300, admin: audience('C · máx. 300 caracteres.') },
            {
              type: 'row',
              fields: [
                { name: 'primaryDomain', label: 'Dominio principal', type: 'relationship', relationTo: 'domains' },
                { name: 'secondaryDomain', label: 'Dominio secundario', type: 'relationship', relationTo: 'domains', admin: audience('Solo con función distinta, observable y con respaldo humano.') },
              ],
            },
            { name: 'domainJustification', label: 'Justificación de dominios', type: 'textarea', localized: true, admin: audience('P') },
            { name: 'mechanisms', label: 'Mecanismos principales', type: 'textarea', localized: true, maxLength: 400, admin: audience('P · máx. 400 caracteres.') },
            { name: 'goalTechnical', label: 'Objetivo funcional — capa técnica', type: 'textarea', localized: true, admin: audience('P · nombre del campo provisional («Función de regreso MAT»).') },
            { name: 'goalEveryday', label: 'Objetivo funcional — vida cotidiana', type: 'textarea', localized: true, admin: audience('C · qué cambio concreto tendría sentido observar.') },
            { name: 'reviewQuestion', label: 'Pregunta de revisión', type: 'text', localized: true, admin: audience('C · una sola pregunta.') },
          ],
        },
        // ------------------------------------------------------------ C
        {
          label: 'C · Forma y calidad',
          fields: [
            { name: 'preferredForm', label: 'Forma preferida', type: 'textarea', localized: true, admin: audience('P') },
            {
              name: 'labelMustDeclare',
              label: 'Datos que la etiqueta debe declarar',
              type: 'select',
              hasMany: true,
              options: [
                { label: 'Especie', value: 'species' },
                { label: 'Parte utilizada', value: 'part' },
                { label: 'Tipo de extracto', value: 'extract-type' },
                { label: 'DER', value: 'der' },
                { label: 'Solvente', value: 'solvent' },
                { label: 'Estandarización', value: 'standardization' },
                { label: 'Forma química', value: 'chemical-form' },
                { label: 'Cantidad elemental', value: 'elemental-amount' },
                { label: 'Cantidad por dosis', value: 'amount-per-dose' },
                { label: 'Fabricante', value: 'manufacturer' },
              ],
            },
            {
              name: 'usualStandardization',
              label: 'Estandarización habitual',
              type: 'array',
              labels: { singular: 'Marcador', plural: 'Marcadores' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'marker', label: 'Marcador', type: 'text', required: true },
                    { name: 'percent', label: '%', type: 'number' },
                  ],
                },
                { name: 'note', label: 'Nota', type: 'text', localized: true },
              ],
            },
            { name: 'labelAvoid', label: 'Qué evitar en la etiqueta', type: 'textarea', localized: true },
          ],
        },
        // ------------------------------------------------------------ D
        {
          label: 'D · Uso, ritmo y revisión',
          description: 'Referencias editoriales. El plan de cada persona se define aparte y no copia estas cifras automáticamente.',
          fields: [
            {
              name: 'referenceDose',
              label: 'Dosis de referencia MAT',
              type: 'group',
              admin: audience('P · información de contexto; no es un límite de seguridad (Libro 2, n.º 19).'),
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'amount', label: 'Cantidad', type: 'number', min: 0 },
                    { name: 'unit', label: 'Unidad', type: 'select', options: AMOUNT_UNITS },
                    { name: 'basis', label: 'Referida a', type: 'select', options: AMOUNT_BASIS },
                    {
                      name: 'frequency',
                      label: 'Frecuencia',
                      type: 'select',
                      options: [
                        { label: 'Al día', value: 'per-day' },
                        { label: 'Por uso', value: 'per-use' },
                        { label: 'A la semana', value: 'per-week' },
                      ],
                    },
                  ],
                },
                { name: 'refersTo', label: 'Descripción', type: 'text', localized: true, admin: audience('p. ej. «de extracto de raíz y rizoma»') },
              ],
            },
            {
              name: 'otherDoseReferences',
              label: 'Otras referencias de dosis',
              type: 'array',
              labels: { singular: 'Referencia', plural: 'Referencias' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'label', label: 'Referencia', type: 'text', required: true, localized: true },
                    { name: 'amount', label: 'Cantidad', type: 'number' },
                    { name: 'unit', label: 'Unidad', type: 'select', options: AMOUNT_UNITS },
                  ],
                },
                { name: 'source', label: 'Fuente', type: 'relationship', relationTo: 'sources' },
                { name: 'note', label: 'Nota', type: 'text', localized: true },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'block', label: 'Bloque', type: 'relationship', relationTo: 'blocks' },
                { name: 'mealRelation', label: 'Relación con las comidas', type: 'select', options: MEAL_RELATION },
              ],
            },
            { name: 'mealNote', label: 'Nota sobre las comidas', type: 'text', localized: true },
            { name: 'usageInstructions', label: 'Instrucciones de uso', type: 'text', localized: true, maxLength: 200, admin: audience('C · se muestra junto a cada toma.') },
            {
              name: 'introductionTags',
              label: 'Inicio escalonado: etiquetas',
              type: 'text',
              hasMany: true,
              admin: audience('p. ej. «activadora». Regla pendiente de confirmar (pendiente n.º 4).'),
            },
            { name: 'introductionNote', label: 'Inicio escalonado: nota', type: 'textarea', localized: true },
            { name: 'rhythm', label: 'Ritmo', type: 'relationship', relationTo: 'rhythms' },
            {
              name: 'rhythmOverride',
              label: 'Duraciones distintas de la plantilla del ritmo',
              type: 'group',
              admin: audience('Dejar vacío para usar las de la plantilla. Si se cambian, justificar.'),
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'useWeeks', label: 'Semanas de uso', type: 'number', min: 1 },
                    { name: 'pauseWeeks', label: 'Semanas de pausa', type: 'number', min: 0 },
                    { name: 'reviewEveryWeeks', label: 'Revisión cada (semanas)', type: 'number', min: 1 },
                  ],
                },
                { name: 'justification', label: 'Justificación', type: 'textarea', localized: true },
              ],
            },
            { name: 'selectiveUse', label: 'Uso selectivo', type: 'checkbox', defaultValue: false },
            { name: 'selectiveCircumstances', label: 'Circunstancias definidas para el uso selectivo', type: 'textarea', localized: true, admin: { condition: (data) => !!data?.selectiveUse } },
            {
              name: 'observations',
              label: 'Qué observar',
              type: 'array',
              labels: { singular: 'Situación', plural: 'Situaciones' },
              maxRows: 3,
              admin: audience('C · 2–3 situaciones concretas. Se convierten en preguntas de la revisión.'),
              fields: [
                { name: 'text', label: 'Situación', type: 'text', required: true, localized: true },
                { name: 'answerType', label: 'Tipo de respuesta', type: 'select', defaultValue: 'scale', options: OBSERVATION_ANSWER_TYPES },
              ],
            },
            {
              name: 'decisionCriteria',
              label: 'Criterios de decisión',
              type: 'array',
              labels: { singular: 'Criterio', plural: 'Criterios' },
              admin: audience('P · orientan al profesional. El sistema no decide.'),
              fields: [
                { name: 'situation', label: 'Situación', type: 'textarea', required: true, localized: true },
                { name: 'decision', label: 'Decisión orientativa', type: 'select', options: REVIEW_OUTCOMES },
              ],
            },
          ],
        },
        // ------------------------------------------------------------ E
        {
          label: 'E · Seguridad',
          description: 'La seguridad esencial siempre es visible para el cliente. Las comprobaciones personalizadas están desactivadas (Libro 2, n.º 26).',
          fields: [
            { name: 'tolerability', label: 'Tolerabilidad habitual', type: 'textarea', localized: true, admin: audience('C') },
            { name: 'adverseEffectsSummary', label: 'Efectos adversos: frase resumen', type: 'textarea', localized: true, admin: audience('C · p. ej. «de frecuencia poco definida, generalmente leves y transitorios».') },
            {
              name: 'adverseEffects',
              label: 'Efectos adversos',
              type: 'array',
              labels: { singular: 'Efecto adverso', plural: 'Efectos adversos' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'effect', label: 'Efecto', type: 'text', required: true, localized: true },
                    {
                      name: 'frequency',
                      label: 'Frecuencia',
                      type: 'select',
                      defaultValue: 'unknown',
                      options: [
                        { label: 'Poco definida', value: 'unknown' },
                        { label: 'Rara', value: 'rare' },
                        { label: 'Poco frecuente', value: 'uncommon' },
                        { label: 'Frecuente', value: 'common' },
                      ],
                    },
                    {
                      name: 'intensity',
                      label: 'Intensidad',
                      type: 'select',
                      options: [
                        { label: 'Leve', value: 'mild' },
                        { label: 'Moderada', value: 'moderate' },
                        { label: 'Grave', value: 'severe' },
                        { label: 'Variable', value: 'variable' },
                      ],
                    },
                  ],
                },
              ],
            },
            signalSummary('alertSummary', 'Resumen de alerta'),
            {
              name: 'precautions',
              label: 'Precauciones',
              type: 'array',
              labels: { singular: 'Precaución', plural: 'Precauciones' },
              fields: [
                { name: 'situation', label: 'Situación o población', type: 'textarea', required: true, localized: true },
                {
                  type: 'row',
                  fields: [
                    { name: 'severity', label: 'Gravedad', type: 'select', options: SEVERITY },
                    { name: 'evidence', label: 'Evidencia', type: 'select', options: EVIDENCE_LEVEL },
                    { name: 'visibleToCustomer', label: 'Visible para el cliente', type: 'checkbox', defaultValue: true },
                  ],
                },
                { name: 'action', label: 'Actuación', type: 'textarea', localized: true },
              ],
            },
            signalSummary('interactionSummary', 'Resumen de interacciones'),
            {
              name: 'interactions',
              label: 'Interacciones',
              type: 'array',
              labels: { singular: 'Interacción', plural: 'Interacciones' },
              fields: [
                { name: 'with', label: 'Con qué', type: 'textarea', required: true, localized: true },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'kind',
                      label: 'Tipo',
                      type: 'select',
                      options: [
                        { label: 'Medicamento', value: 'medication' },
                        { label: 'Grupo de medicamentos', value: 'drug-class' },
                        { label: 'Suplemento', value: 'supplement' },
                        { label: 'Alimento', value: 'food' },
                        { label: 'Otro', value: 'other' },
                      ],
                    },
                    { name: 'severity', label: 'Gravedad', type: 'select', options: SEVERITY },
                    { name: 'evidence', label: 'Evidencia', type: 'select', options: EVIDENCE_LEVEL },
                    { name: 'visibleToCustomer', label: 'Visible para el cliente', type: 'checkbox', defaultValue: false },
                  ],
                },
                { name: 'action', label: 'Actuación', type: 'textarea', localized: true },
              ],
            },
            { name: 'pauseSignals', label: 'Señales para pausar y consultar', type: 'array', labels: { singular: 'Señal', plural: 'Señales' }, fields: [{ name: 'text', label: 'Señal', type: 'text', required: true, localized: true }] },
            { name: 'urgentSignals', label: 'Señales de urgencia', type: 'array', labels: { singular: 'Señal', plural: 'Señales' }, fields: [{ name: 'text', label: 'Señal', type: 'text', required: true, localized: true }] },
          ],
        },
        // ------------------------------------------------------------ F
        {
          label: 'F · Evidencia',
          fields: [
            { name: 'evidenceSummary', label: 'Nivel de evidencia (resumen)', type: 'textarea', localized: true, admin: audience('C+') },
            {
              name: 'claims',
              label: 'Afirmaciones respaldadas',
              type: 'array',
              labels: { singular: 'Afirmación', plural: 'Afirmaciones' },
              fields: [
                { name: 'claim', label: 'Afirmación', type: 'textarea', required: true, localized: true },
                {
                  type: 'row',
                  fields: [
                    { name: 'classification', label: 'Clasificación', type: 'select', required: true, options: CLAIM_CLASSIFICATION },
                    { name: 'population', label: 'Población', type: 'text', localized: true },
                    { name: 'preparationAndDose', label: 'Preparación y dosis', type: 'text', localized: true },
                  ],
                },
                { name: 'result', label: 'Resultado', type: 'textarea', localized: true },
                { name: 'sources', label: 'Fuentes', type: 'relationship', relationTo: 'sources', hasMany: true },
              ],
            },
          ],
        },
        // ------------------------------------------------------------ G
        {
          label: 'G · Saber más',
          description: 'Textos largos y opcionales. La Entrada MAT y el Cierre no entran en la app.',
          fields: [
            { name: 'moreWhatIs', label: 'Qué es', type: 'richText', localized: true, admin: audience('C+ · punto 2') },
            { name: 'moreWhyUseful', label: 'Por qué puede ser útil', type: 'richText', localized: true, admin: audience('P · punto 3, sin el marco del aislamiento') },
            { name: 'moreHowToUse', label: 'Cómo se usa y se revisa', type: 'richText', localized: true, admin: audience('P · punto 4') },
            { name: 'moreCautions', label: 'Cuidados y límites', type: 'richText', localized: true, admin: audience('C+ y P · punto 5') },
          ],
        },
        // ------------------------------------------------------------ H
        {
          label: 'H · Fuentes y control',
          fields: [
            { name: 'sources', label: 'Fuentes', type: 'relationship', relationTo: 'sources', hasMany: true },
            {
              type: 'row',
              fields: [
                { name: 'author', label: 'Autor', type: 'relationship', relationTo: 'users' },
                { name: 'reviewer', label: 'Revisor profesional', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
                { name: 'approvedAt', label: 'Aprobada el', type: 'date', admin: { readOnly: true } },
              ],
            },
            { name: 'internalNotes', label: 'Notas internas', type: 'textarea' },
          ],
        },
      ],
    },
    // ---------------------------------------------------------------- barra lateral
    {
      name: 'editorialStatus',
      label: 'Estado editorial',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: EDITORIAL_STATUS,
      admin: { position: 'sidebar', description: 'Solo las fichas aprobadas se publican. Aprobar requiere rol de revisión.' },
    },
    {
      name: 'translationStatus',
      label: 'Estado de este idioma',
      type: 'select',
      localized: true,
      defaultValue: 'draft',
      options: TRANSLATION_STATUS,
      admin: { position: 'sidebar', description: 'Un idioma no aprobado no se muestra al cliente (Libro 2, n.º 36).' },
    },
    {
      name: 'regulatoryStatusCH',
      label: 'Estado regulatorio en Suiza',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pendiente', value: 'pending' },
        { label: 'Comprobado', value: 'checked' },
        { label: 'No apto', value: 'not-suitable' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'regulatoryNote', label: 'Nota regulatoria', type: 'textarea', admin: { position: 'sidebar' } },
    {
      name: 'isFictional',
      label: 'Ficha ficticia (demo)',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
  ],
}
