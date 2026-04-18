import { useState } from 'react'
import {
  ExternalLink,
  MapPin,
  Phone,
  ChevronDown,
  ChevronUp,
  Activity,
  Tag,
  FileText,
  Users,
} from 'lucide-react'

const STATUS_STYLES = {
  RECRUITING: {
    badge: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500 animate-pulse',
    label: 'Recruiting',
  },
  ACTIVE_NOT_RECRUITING: {
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    dot: 'bg-yellow-500',
    label: 'Active (Not Recruiting)',
  },
  COMPLETED: {
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
    label: 'Completed',
  },
  TERMINATED: {
    badge: 'bg-red-100 text-red-600 border-red-200',
    dot: 'bg-red-400',
    label: 'Terminated',
  },
  SUSPENDED: {
    badge: 'bg-orange-100 text-orange-600 border-orange-200',
    dot: 'bg-orange-400',
    label: 'Suspended',
  },
  WITHDRAWN: {
    badge: 'bg-gray-100 text-gray-500 border-gray-200',
    dot: 'bg-gray-300',
    label: 'Withdrawn',
  },
  NOT_YET_RECRUITING: {
    badge: 'bg-blue-100 text-blue-600 border-blue-200',
    dot: 'bg-blue-400',
    label: 'Not Yet Recruiting',
  },
  default: {
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
    label: 'Unknown',
  },
}

const PHASE_STYLES = {
  'Phase 1': 'bg-purple-100 text-purple-700 border-purple-200',
  'Phase 2': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Phase 3': 'bg-blue-100 text-blue-700 border-blue-200',
  'Phase 4': 'bg-teal-100 text-teal-700 border-teal-200',
  'N/A': 'bg-gray-100 text-gray-500 border-gray-200',
  default: 'bg-gray-100 text-gray-600 border-gray-200',
}

function getStatusStyle(status) {
  const normalizedStatus = status?.toUpperCase().replace(/[\s-]/g, '_')
  return STATUS_STYLES[normalizedStatus] || STATUS_STYLES.default
}

function getPhaseStyle(phase) {
  return PHASE_STYLES[phase] || PHASE_STYLES.default
}

function truncateEligibility(text, maxLen = 200) {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trim() + '...'
}

// Safely convert contact to a displayable string
// Handles both plain strings and objects {name, email, phone, role}
function formatContact(contact) {
  if (!contact) return null
  if (typeof contact === 'string') return contact
  if (typeof contact === 'object') {
    const parts = [contact.name, contact.email, contact.phone]
      .filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }
  return null
}

// Safely convert location to a displayable string
// Handles both plain strings and objects {facility, city, state, country}
function formatLocation(location) {
  if (!location) return null
  if (typeof location === 'string') return location
  if (typeof location === 'object') {
    const parts = [location.facility, location.city, location.state, location.country]
      .filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }
  return null
}

export default function ClinicalTrialCard({ trial, index }) {
  const [showFullEligibility, setShowFullEligibility] = useState(false)

  const {
    title,
    nctId,
    status,
    phase,
    eligibility,
    locations,
    contacts,
    briefSummary,
    enrollment,
  } = trial

  const statusStyle = getStatusStyle(status)
  const phaseStyle = getPhaseStyle(phase)
  const ctGovUrl = nctId ? `https://clinicaltrials.gov/study/${nctId}` : null
  const hasLongEligibility = eligibility && eligibility.length > 200

  // Convert to safe displayable strings
  const firstLocation = locations && locations.length > 0
    ? formatLocation(locations[0])
    : null

  const firstContact = contacts && contacts.length > 0
    ? formatContact(contacts[0])
    : null

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all duration-200 bg-white">
      {/* Card Header */}
      <div className="p-4">

        {/* Index + Badges row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs font-bold text-gray-400 w-5">#{index + 1}</span>

          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            {statusStyle.label}
          </span>

          {/* Phase badge */}
          {phase && phase !== 'N/A' && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${phaseStyle}`}
            >
              <Tag className="w-2.5 h-2.5" />
              {phase}
            </span>
          )}

          {/* NCT ID */}
          {nctId && (
            <span className="text-xs font-mono text-gray-400 ml-auto">{nctId}</span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-3">
          {title || 'Untitled Clinical Trial'}
        </h3>

        {/* Brief summary (shown if no eligibility) */}
        {!eligibility && briefSummary && (
          <p className="text-xs text-gray-500 leading-relaxed mb-2">
            {briefSummary.substring(0, 200)}{briefSummary.length > 200 ? '...' : ''}
          </p>
        )}

        {/* Details */}
        <div className="space-y-2">

          {/* Eligibility */}
          {eligibility && (
            <div className="flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 mb-0.5">Eligibility Criteria</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {showFullEligibility ? eligibility : truncateEligibility(eligibility)}
                </p>
                {hasLongEligibility && (
                  <button
                    onClick={() => setShowFullEligibility(!showFullEligibility)}
                    className="flex items-center gap-1 text-blue-500 text-xs font-medium mt-1 hover:text-blue-600 transition-colors"
                  >
                    {showFullEligibility ? (
                      <><ChevronUp className="w-3 h-3" /> Show less</>
                    ) : (
                      <><ChevronDown className="w-3 h-3" /> Read more</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          {firstLocation && (
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">
                  Location{locations.length > 1 ? ` (+${locations.length - 1} more)` : ''}
                </p>
                <p className="text-xs text-gray-600">{firstLocation}</p>
              </div>
            </div>
          )}

          {/* Contact */}
          {firstContact && (
            <div className="flex items-start gap-2">
              <Phone className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Contact</p>
                <p className="text-xs text-gray-600">{firstContact}</p>
              </div>
            </div>
          )}

          {/* Sites + enrollment */}
          <div className="flex items-center gap-4">
            {locations && locations.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                <p className="text-xs text-gray-500">
                  {locations.length} site{locations.length > 1 ? 's' : ''} worldwide
                </p>
              </div>
            )}
            {enrollment > 0 && (
              <p className="text-xs text-gray-500">{enrollment} participants</p>
            )}
          </div>

        </div>
      </div>

      {/* Card Footer */}
      {ctGovUrl && (
        <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/50 flex items-center justify-between">
          <button
            onClick={() => window.open(ctGovUrl, '_blank', 'noopener,noreferrer')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
          >
            <Activity className="w-3 h-3" />
            View on ClinicalTrials.gov
            <ExternalLink className="w-3 h-3" />
          </button>
          {nctId && (
            <span className="text-xs text-gray-400 font-mono">{nctId}</span>
          )}
        </div>
      )}
    </div>
  )
}