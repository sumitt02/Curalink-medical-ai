import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 180000, // 3 min — HuggingFace cold starts can be slow
})

api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred'
    console.error('[API Error]', message)
    return Promise.reject(new Error(message))
  }
)

/**
 * Send a chat message to the AI assistant
 */
export const sendMessage = async (
  sessionId,
  message,
  disease = '',
  patientName = '',
  location = '',
  isStructured = false
) => {
  const payload = {
    sessionId,
    message,
    ...(disease && { disease }),
    ...(patientName && { patientName }),
    ...(location && { location }),
    isStructured: !!isStructured,
  }

  const response = await api.post('/chat', payload)
  const raw = response.data

  // ── Map backend response → frontend format ──
  // Backend sends: { llmResponse, publications, trials, stats }
  // Frontend needs: { message, structured, publications, trials }
  return {
    ...raw,

    // Plain text fallback
    message: raw.llmResponse?.conditionOverview
      ? raw.llmResponse.conditionOverview
      : 'Research analysis complete.',

    // Structured sections for Overview / Insights / Trials tabs
    structured: raw.llmResponse
      ? {
          conditionOverview: raw.llmResponse.conditionOverview || '',
          researchInsights:  raw.llmResponse.researchInsights  || '',
          clinicalTrials:    raw.llmResponse.clinicalTrials    || '',
          recommendations:   raw.llmResponse.recommendations   || '',
          disclaimer:        raw.llmResponse.disclaimer        || '',
          isFallback:        raw.llmResponse.isFallback        || false,
          llmSource:         raw.llmResponse.llmSource         || 'fallback',
        }
      : null,

    publications: raw.publications || [],
    trials:       raw.trials       || [],

    totalFetched:
      (raw.stats?.pubmedCount || 0) +
      (raw.stats?.openAlexCount || 0),

    queryExpanded: raw.query?.message || '',
  }
}

/**
 * Get conversation history for a session
 */
export const getHistory = async (sessionId) => {
  const response = await api.get(`/sessions/${sessionId}/history`)
  return response.data
}

export default api