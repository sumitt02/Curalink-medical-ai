import { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronUp, Users, Calendar, BookOpen } from 'lucide-react'

const SOURCE_STYLES = {
  PubMed: {
    badge: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500',
    label: 'PubMed',
  },
  OpenAlex: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    label: 'OpenAlex',
  },
  default: {
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
    label: 'Journal',
  },
}

function formatAuthors(authors = []) {
  if (!authors || authors.length === 0) return 'Unknown Authors'
  if (authors.length <= 3) return authors.join(', ')
  return `${authors.slice(0, 3).join(', ')} et al.`
}

function truncateAbstract(abstract, maxLen = 300) {
  if (!abstract || abstract.length <= maxLen) return abstract
  const cut = abstract.slice(0, maxLen)
  const lastPeriod = cut.lastIndexOf('.')
  return lastPeriod > 50 ? cut.slice(0, lastPeriod + 1) : cut.trim() + '...'
}

export default function PublicationCard({ publication, index }) {
  const [expanded, setExpanded] = useState(false)

  const {
    title,
    abstract,
    authors,
    year,
    source,
    url,
    score,
  } = publication

  const sourceStyle = SOURCE_STYLES[source] || SOURCE_STYLES.default
  const hasLongAbstract = abstract && abstract.length > 200

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all duration-200 bg-white">
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Index + Source */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-gray-400 w-5">#{index + 1}</span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${sourceStyle.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${sourceStyle.dot}`} />
                {sourceStyle.label}
              </span>
              {year && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {year}
                </span>
              )}
              {score != null && (
                <span className="text-xs text-gray-300 ml-auto">
                  relevance: {(score * 100).toFixed(0)}%
                </span>
              )}
            </div>

            {/* Title */}
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block font-semibold text-gray-900 text-sm leading-snug hover:text-blue-600 transition-colors group"
              >
                {title || 'Untitled Publication'}
                <ExternalLink className="w-3 h-3 inline ml-1 text-gray-300 group-hover:text-blue-500 transition-colors" />
              </a>
            ) : (
              <p className="font-semibold text-gray-900 text-sm leading-snug">
                {title || 'Untitled Publication'}
              </p>
            )}

            {/* Authors */}
            {authors && authors.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Users className="w-3 h-3 text-gray-300 flex-shrink-0" />
                <p className="text-xs text-gray-500 truncate">{formatAuthors(authors)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Abstract */}
        {abstract && (
          <div className="mt-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BookOpen className="w-3 h-3 text-gray-300" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Abstract</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {expanded ? abstract : truncateAbstract(abstract)}
            </p>
            {hasLongAbstract && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-blue-500 text-xs font-medium mt-1.5 hover:text-blue-600 transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> Read more
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Card Footer */}
      {url && (
        <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/50">
          <button
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            View Full Paper
          </button>
        </div>
      )}
    </div>
  )
}