import { useState } from 'react'
import {
  FileText,
  BookOpen,
  FlaskConical,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Search,
  Shield,
} from 'lucide-react'
import PublicationCard from './PublicationCard.jsx'
import ClinicalTrialCard from './ClinicalTrialCard.jsx'

const TABS = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'research', label: 'Research', icon: BookOpen },
  { id: 'trials', label: 'Clinical Trials', icon: FlaskConical },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
]

function OverviewSection({ structured, queryExpanded }) {
  const [showFullInsights, setShowFullInsights] = useState(false)

  const overview = structured?.conditionOverview || ''
  const recommendations = structured?.recommendations || ''

  return (
    <div className="space-y-4">
      {/* Query expanded badge */}
      {queryExpanded && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <Search className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-blue-700 mb-0.5">Query Optimized</p>
            <p className="text-xs text-blue-600 italic">"{queryExpanded}"</p>
          </div>
        </div>
      )}

      {/* Condition Overview — always fully visible, no clamp */}
      {overview ? (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Condition Overview
          </p>
          <p
            className="text-sm text-gray-700 leading-relaxed"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {overview}
          </p>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-400">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Overview is being generated...</p>
        </div>
      )}

      {/* Research Insights summary in Overview tab */}
      {structured?.researchInsights && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Key Research Findings
          </p>
          <div
            className={`text-sm text-gray-700 leading-relaxed ${
              !showFullInsights ? 'line-clamp-6' : ''
            }`}
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {structured.researchInsights}
          </div>
          <button
            onClick={() => setShowFullInsights(!showFullInsights)}
            className="flex items-center gap-1 text-blue-600 text-xs font-medium mt-2 hover:text-blue-700 transition-colors"
          >
            {showFullInsights ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> Show full research findings</>
            )}
          </button>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-xs font-semibold text-amber-800 mb-2 uppercase tracking-wide">
            Recommendations
          </p>
          <p
            className="text-sm text-amber-700 leading-relaxed"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {recommendations}
          </p>
        </div>
      )}
    </div>
  )
}

function InsightsSection({ structured }) {
  const text = structured?.researchInsights || structured?.clinicalTrials || ''

  if (!text) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No additional insights available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {structured?.researchInsights && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Research Insights
          </p>
          <p
            className="text-sm text-gray-700 leading-relaxed"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {structured.researchInsights}
          </p>
        </div>
      )}
      {structured?.clinicalTrials && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Trial Overview
          </p>
          <p
            className="text-sm text-gray-700 leading-relaxed"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {structured.clinicalTrials}
          </p>
        </div>
      )}
    </div>
  )
}

export default function StructuredResponse({
  message,
  structured,
  publications,
  trials,
  queryExpanded,
}) {
  const [activeTab, setActiveTab] = useState('overview')

  const tabCounts = {
    overview: null,
    research: publications.length || null,
    trials: trials.length || null,
    insights: null,
  }

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-100 bg-gray-50/50">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-all duration-200 ${
              activeTab === id
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {tabCounts[id] > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {tabCounts[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-5 tab-content-enter">
        {activeTab === 'overview' && (
          <OverviewSection
            structured={structured}
            queryExpanded={queryExpanded}
          />
        )}

        {activeTab === 'research' && (
          <div>
            {publications.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No publications found for this query.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 mb-3">
                  Found <span className="font-semibold text-gray-700">{publications.length}</span> relevant publications
                </p>
                {publications.map((pub, i) => (
                  <PublicationCard key={pub.url || i} publication={pub} index={i} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'trials' && (
          <div>
            {trials.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No clinical trials found for this condition.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 mb-3">
                  Found <span className="font-semibold text-gray-700">{trials.length}</span> clinical trials
                </p>
                {trials.map((trial, i) => (
                  <ClinicalTrialCard key={trial.nctId || i} trial={trial} index={i} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <InsightsSection structured={structured} />
        )}
      </div>

      {/* Disclaimer Footer */}
      {structured?.disclaimer && (
        <div className="px-5 pb-4">
          <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <Shield className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-400 leading-relaxed">
              {structured.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}