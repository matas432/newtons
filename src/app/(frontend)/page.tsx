import Link from 'next/link'
import React from 'react'

import './styles.css'

export default function HomePage() {
  return (
    <main className="home">
      <p className="eyebrow">Proyecto app-suplementos</p>
      <h1>Newtons</h1>
      <p className="lead">El asesoramiento continúa en casa.</p>
      <p>Prototipo en construcción, con datos ficticios.</p>
      <Link className="button" href="/admin">
        Panel editorial y de droguerías
      </Link>
    </main>
  )
}
