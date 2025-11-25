import './globals.css'

export const metadata = {
  title: 'CoursAI - 愛知県立大学 履修サポートAI',
  description: 'AIが最適な履修プランを提案します',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}