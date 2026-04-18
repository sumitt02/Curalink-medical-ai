import { useState } from 'react'
import {
  Activity,
  Plus,
  MessageSquare,
  ChevronRight,
  Stethoscope,
  BookOpen,
  FlaskConical,
  Shield,
  Clock,
} from 'lucide-react'
import ChatInterface from '../components/ChatInterface.jsx'

const recentTopics = [
  { icon: Activity, label: 'Lung cancer treatments', color: 'text-red-400' },
  { icon: FlaskConical, label: 'Diabetes clinical trials', color: 'text-green-400' },
  { icon: BookOpen, label: "Alzheimer's researchers", color: 'text-purple-400' },
  { icon: Stethoscope, label: 'Heart disease studies', color: 'text-blue-400' },
]

export default function Home({ sessionId, onNewChat }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-[#060e1e] border-r border-white/10 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="flex items-center justify-center w-9 h-9 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/30">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Curalink</h1>
            <p className="text-blue-400/70 text-xs mt-0.5">AI Medical Research</p>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="px-3 py-3">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-all duration-200 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30"
          >
            <Plus className="w-4 h-4" />
            New Research Session
          </button>
        </div>

        {/* Recent Queries */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-wider px-2 mb-2">
            Recent Topics
          </p>
          <div className="space-y-0.5">
            {recentTopics.map(({ icon: Icon, label, color }, i) => (
              <button
                key={i}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-left group transition-all duration-150"
              >
                <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
                <span className="text-white/60 text-sm group-hover:text-white/90 truncate transition-colors">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="px-4 py-4 border-t border-white/10">
          {/* Session Info */}
          <div className="flex items-start gap-2 mb-3 p-2.5 bg-white/5 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-blue-400/70 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white/40 text-xs">Session ID</p>
              <p className="text-white/60 text-xs font-mono truncate">
                {sessionId?.slice(0, 16)}...
              </p>
            </div>
          </div>

          {/* Disclaimer badge */}
          <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <Shield className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-amber-400/80 text-xs leading-tight">
              For research purposes only. Not a substitute for professional medical advice.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              title="Toggle sidebar"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-gray-600 font-medium">
                AI Research Assistant <span className="text-gray-400">· Ready</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
              Powered by PubMed · OpenAlex · ClinicalTrials.gov
            </span>
            <ChevronRight className="w-3 h-3 text-gray-300" />
          </div>
        </header>

        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface sessionId={sessionId} />
        </div>
      </main>
    </div>
  )
}
