import { User, Microscope, AlertCircle } from 'lucide-react'
import StructuredResponse from './StructuredResponse.jsx'

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message }) {
  const { role, content, data, timestamp } = message
  const isUser = role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 message-enter">
        <div className="flex flex-col items-end max-w-[75%]">
          <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-md shadow-blue-600/20">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
          </div>
          <span className="text-xs text-gray-400 mt-1 mr-1">{formatTime(timestamp)}</span>
        </div>
        <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mt-auto mb-5">
          <User className="w-4 h-4 text-gray-600" />
        </div>
      </div>
    )
  }

  // Assistant message
  if (data?.error) {
    return (
      <div className="flex items-start gap-3 message-enter">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
          <Microscope className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-4 py-3 rounded-2xl rounded-tl-sm text-red-600 text-sm max-w-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            {data.error || 'Something went wrong. Please try again.'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 message-enter">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-md mt-1">
        <Microscope className="w-4 h-4 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-900">Curalink AI</span>
          <span className="text-xs text-gray-400">{formatTime(timestamp)}</span>
          {data?.publications?.length > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium border border-green-200">
              {data.publications.length} papers
            </span>
          )}
          {data?.trials?.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium border border-blue-200">
              {data.trials.length} trials
            </span>
          )}
          {data?.totalFetched > 0 && (
            <span className="text-xs text-gray-400">
              ({data.totalFetched} total results scanned)
            </span>
          )}
        </div>

        {/* Main content card */}
        <div className="bg-white rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm overflow-hidden">
          {data && (data.structured || data.publications?.length > 0 || data.trials?.length > 0) ? (
            <StructuredResponse
              message={content}
              structured={data.structured}
              publications={data.publications || []}
              trials={data.trials || []}
              queryExpanded={data.queryExpanded}
            />
          ) : (
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {content || 'No response content available.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
