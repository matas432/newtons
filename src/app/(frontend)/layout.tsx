import React from 'react'
import './styles.css'

export const metadata = {
  description: 'Plataforma de información y acompañamiento de suplementos para droguerías.',
  title: 'Newtons',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
