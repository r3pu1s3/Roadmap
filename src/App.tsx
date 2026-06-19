import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import FlowWithProvider from './pages/Canvas'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
     <FlowWithProvider></FlowWithProvider>
    </>
  )
}

export default App
