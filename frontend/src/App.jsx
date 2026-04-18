import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Home from './pages/Home.jsx'

function App() {
  const [sessionId, setSessionId] = useState(null)

  useEffect(() => {
    // Retrieve or create a persistent session ID
    let storedSession = localStorage.getItem('curalink_session_id')
    if (!storedSession) {
      storedSession = uuidv4()
      localStorage.setItem('curalink_session_id', storedSession)
    }
    setSessionId(storedSession)
  }, [])

  const handleNewChat = () => {
    const newSessionId = uuidv4()
    localStorage.setItem('curalink_session_id', newSessionId)
    setSessionId(newSessionId)
  }

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a1628]">
        <div className="flex items-center gap-3 text-blue-400">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-lg font-medium">Initializing Curalink...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-[#0a1628]">
      <Home sessionId={sessionId} onNewChat={handleNewChat} />
    </div>
  )
}

export default App
