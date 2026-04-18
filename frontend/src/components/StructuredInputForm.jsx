import { useState } from 'react'
import { User, Stethoscope, MapPin, MessageSquare, Send, AlertCircle } from 'lucide-react'

export default function StructuredInputForm({ onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    patientName: '',
    disease: '',
    query: '',
    location: '',
  })
  const [errors, setErrors] = useState({})

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.disease.trim()) {
      newErrors.disease = 'Disease or condition is required'
    }
    if (!formData.query.trim()) {
      newErrors.query = 'Please enter your question'
    }
    return newErrors
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    // Build a natural language message from structured inputs
    let message = formData.query.trim()
    if (formData.disease.trim()) {
      message = `[Disease: ${formData.disease.trim()}] ${message}`
    }
    if (formData.patientName.trim()) {
      message = `[Patient: ${formData.patientName.trim()}] ${message}`
    }
    if (formData.location.trim()) {
      message += ` (Location preference: ${formData.location.trim()})`
    }

    onSubmit(message, {
      disease: formData.disease.trim(),
      patientName: formData.patientName.trim(),
      location: formData.location.trim(),
    })

    // Reset form
    setFormData({ patientName: '', disease: '', query: '', location: '' })
    setErrors({})
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Patient Name */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            <User className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
            Patient Name{' '}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={formData.patientName}
            onChange={handleChange('patientName')}
            placeholder="e.g. John Doe"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
            disabled={isLoading}
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            <MapPin className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
            Location{' '}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={handleChange('location')}
            placeholder="e.g. New York, USA"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Disease */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          <Stethoscope className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
          Disease / Condition <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={formData.disease}
          onChange={handleChange('disease')}
          placeholder="e.g. Non-small cell lung cancer, Type 2 Diabetes..."
          className={`w-full px-3 py-2 rounded-xl border text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
            errors.disease
              ? 'border-red-300 bg-red-50 focus:bg-white'
              : 'border-gray-200 bg-gray-50 focus:bg-white'
          }`}
          disabled={isLoading}
        />
        {errors.disease && (
          <p className="flex items-center gap-1 text-red-500 text-xs mt-1">
            <AlertCircle className="w-3 h-3" />
            {errors.disease}
          </p>
        )}
      </div>

      {/* Query */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          <MessageSquare className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
          Your Question / Query <span className="text-red-400">*</span>
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <textarea
              value={formData.query}
              onChange={handleChange('query')}
              placeholder="e.g. What are the latest treatments? Are there active clinical trials?"
              rows={2}
              className={`w-full resize-none px-3 py-2 rounded-xl border text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.query
                  ? 'border-red-300 bg-red-50 focus:bg-white'
                  : 'border-gray-200 bg-gray-50 focus:bg-white'
              }`}
              disabled={isLoading}
            />
            {errors.query && (
              <p className="flex items-center gap-1 text-red-500 text-xs mt-1">
                <AlertCircle className="w-3 h-3" />
                {errors.query}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-shrink-0 self-start flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:shadow-none mt-0"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Search</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
