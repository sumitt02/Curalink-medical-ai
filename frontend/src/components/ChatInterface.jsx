import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Microscope,
  FlaskConical,
  Brain,
  Heart,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from 'lucide-react'
import { sendMessage } from '../services/api.js'
import MessageBubble from './MessageBubble.jsx'
import StructuredInputForm from './StructuredInputForm.jsx'

const EXAMPLE_QUERIES = [
  {
    icon: Microscope,
    color: 'text-red-500',
    bgColor: 'bg-red-50 border-red-100',
    hoverColor: 'hover:border-red-300 hover:bg-red-100/50',
    title: 'Latest treatment for lung cancer',
    subtitle: 'Current therapies & clinical evidence',
    query: 'What are the latest treatment options for non-small cell lung cancer?',
  },
  {
    icon: FlaskConical,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-100',
    hoverColor: 'hover:border-green-300 hover:bg-green-100/50',
    title: 'Clinical trials for diabetes',
    subtitle: 'Active recruiting trials worldwide',
    query: 'Show me active clinical trials for type 2 diabetes management',
  },
  {
    icon: Brain,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-100',
    hoverColor: 'hover:border-purple-300 hover:bg-purple-100/50',
    title: "Top researchers in Alzheimer's",
    subtitle: 'Leading research and publications',
    query: "Who are the top researchers in Alzheimer's disease and what are their recent findings?",
  },
  {
    icon: Heart,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-100',
    hoverColor: 'hover:border-blue-300 hover:bg-blue-100/50',
    title: 'Recent studies on heart disease',
    subtitle: 'Cardiovascular research highlights',
    query: 'What are the most recent research studies on cardiovascular disease prevention?',
  },
]

export default function ChatInterface({ sessionId }) {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStructuredMode, setIsStructuredMode] = useState(false)
  const [error, setError] = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  useEffect(() => {
    if (!isStructuredMode) {
      inputRef.current?.focus()
    }
  }, [isStructuredMode])

  const addMessage = (role, content, data = null) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        role,
        content,
        data,
        timestamp: new Date(),
      },
    ])
  }

  const handleSend = async (messageText, structuredData = null) => {
    const text = messageText?.trim() || inputText.trim()
    if (!text || isLoading) return

    setError(null)
    setInputText('')

    // Add user message
    addMessage('user', text)
    setIsLoading(true)

    try {
      let response
      if (structuredData) {
        response = await sendMessage(
          sessionId,
          text,
          structuredData.disease,
          structuredData.patientName,
          structuredData.location,
          true
        )
      } else {
        response = await sendMessage(sessionId, text)
      }

      addMessage('assistant', response.message, response)
    } catch (err) {
      setError(err.message || 'Failed to get response. Please try again.')
      addMessage('assistant', null, { error: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleExampleClick = (query) => {
    handleSend(query)
  }

  const isWelcomeScreen = messages.length === 0

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {isWelcomeScreen ? (
          /* Welcome Screen */
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12">
            <div className="max-w-2xl w-full text-center">
              {/* Logo mark */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/30">
                    <Microscope className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-[#f8fafc] flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">AI</span>
                  </div>
                </div>
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome to{' '}
                <span className="text-blue-600">Curalink</span>
              </h2>
              <p className="text-gray-500 text-base mb-8 max-w-lg mx-auto">
                Your AI-powered medical research assistant. Ask about diseases, treatments,
                clinical trials, and the latest research findings.
              </p>

              {/* Example Cards */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {EXAMPLE_QUERIES.map(
                  ({ icon: Icon, color, bgColor, hoverColor, title, subtitle, query }, i) => (
                    <button
                      key={i}
                      onClick={() => handleExampleClick(query)}
                      className={`flex items-start gap-3 p-4 rounded-xl border ${bgColor} ${hoverColor} text-left transition-all duration-200 group`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 ${color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm group-hover:text-gray-900">
                          {title}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 ml-auto mt-0.5 transition-colors" />
                    </button>
                  )
                )}
              </div>

              <p className="text-xs text-gray-400">
                Sources: PubMed, OpenAlex, ClinicalTrials.gov · Updated in real-time
              </p>
            </div>
          </div>
        ) : (
          /* Messages List */
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-start gap-3 animate-fade-in">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                  <Microscope className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <div className="typing-dot w-2.5 h-2.5 bg-blue-400 rounded-full" />
                    <div className="typing-dot w-2.5 h-2.5 bg-blue-400 rounded-full" />
                    <div className="typing-dot w-2.5 h-2.5 bg-blue-400 rounded-full" />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Searching medical databases...</p>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-4 py-4 shadow-lg">
        <div className="max-w-3xl mx-auto">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsStructuredMode(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  !isStructuredMode
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Send className="w-3 h-3" />
                Simple Chat
              </button>
              <button
                onClick={() => setIsStructuredMode(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  isStructuredMode
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FlaskConical className="w-3 h-3" />
                Structured Input
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              {isStructuredMode ? (
                <ToggleRight className="w-4 h-4 text-blue-500" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-gray-400" />
              )}
              <span>{isStructuredMode ? 'Structured' : 'Chat'} mode</span>
            </div>
          </div>

          {/* Input Form */}
          {isStructuredMode ? (
            <StructuredInputForm onSubmit={handleSend} isLoading={isLoading} />
          ) : (
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about treatments, research, clinical trials..."
                  rows={1}
                  className="w-full resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 pr-12 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200 max-h-32 min-h-[48px]"
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                  }}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={() => handleSend()}
                disabled={!inputText.trim() || isLoading}
                className="flex-shrink-0 w-11 h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg disabled:shadow-none"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-2">
            Curalink searches PubMed, OpenAlex & ClinicalTrials.gov · Not medical advice
          </p>
        </div>
      </div>
    </div>
  )
}
