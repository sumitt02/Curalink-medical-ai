const axios = require('axios');

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TIMEOUT = 60000;
const MAX_PROMPT_CHARS = 6000; // Keep well under token limits

// ─────────────────────────────────────────────
// Prompt Builder — kept short to avoid 400 errors
// ─────────────────────────────────────────────
function formatPublicationsForPrompt(publications) {
  if (!publications || publications.length === 0) return 'No publications found.';
  return publications
    .slice(0, 5) // Max 5 papers
    .map((pub, idx) => {
      const authors = Array.isArray(pub.authors)
        ? pub.authors.slice(0, 2).join(', ')
        : 'Unknown';
      const abstract = pub.abstract
        ? pub.abstract.substring(0, 200) // Shorter abstract
        : 'Abstract not available.';
      return `[Paper ${idx + 1}] "${pub.title || 'N/A'}" by ${authors} (${pub.year || 'N/A'}, ${pub.source === 'pubmed' ? 'PubMed' : 'OpenAlex'})
Abstract: ${abstract}`;
    })
    .join('\n\n');
}

function formatTrialsForPrompt(trials) {
  if (!trials || trials.length === 0) return 'No clinical trials found.';
  return trials
    .slice(0, 3) // Max 3 trials
    .map((trial, idx) => {
      return `[Trial ${idx + 1}] ${trial.title || 'N/A'} | Status: ${trial.status || 'N/A'} | NCT: ${trial.nctId || 'N/A'}`;
    })
    .join('\n');
}

function buildPrompt({ disease, query, publications, trials }) {
  const pubText = formatPublicationsForPrompt(publications);
  const trialText = formatTrialsForPrompt(trials);

  const prompt = `You are CuraLink, a medical research assistant. Analyze this research and respond with exactly 5 sections.

Disease: ${disease || 'Not specified'}
Query: ${query || 'General overview'}

RESEARCH PAPERS:
${pubText}

CLINICAL TRIALS:
${trialText}

Respond with EXACTLY these sections (use these exact headings):

1. CONDITION OVERVIEW
(2-3 sentences about ${disease || 'the condition'} based on the research above)

2. RESEARCH INSIGHTS
(4-5 key findings from the papers above, cite paper titles)

3. CLINICAL TRIALS SUMMARY
(2-3 points about the trials above)

4. RECOMMENDATIONS
(3-4 evidence-based recommendations)

5. DISCLAIMER
This information is for research and educational purposes only and does not constitute medical advice.`;

  // Trim if still too long
  return prompt.length > MAX_PROMPT_CHARS
    ? prompt.substring(0, MAX_PROMPT_CHARS)
    : prompt;
}

// ─────────────────────────────────────────────
// Groq API Call
// ─────────────────────────────────────────────
async function callGroq(prompt) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not set in .env');
  }

  console.log(`[LLM] Calling Groq (${GROQ_MODEL}), prompt length: ${prompt.length} chars`);

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are CuraLink, an expert AI medical research assistant. Always respond with exactly the 5 numbered sections requested. Be concise and cite specific papers.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 5000,
        temperature: 0.3,
        top_p: 0.9,
      },
      {
        timeout: GROQ_TIMEOUT,
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from Groq');

    console.log('[LLM] ✅ Groq response received, length:', text.length);
    return text;

  } catch (err) {
    // Log the full error for debugging
    const status = err.response?.status;
    const errorData = err.response?.data;
    console.error(`[LLM] Groq error - Status: ${status}`);
    console.error(`[LLM] Groq error - Data:`, JSON.stringify(errorData));
    throw new Error(`Groq ${status}: ${JSON.stringify(errorData) || err.message}`);
  }
}

// ─────────────────────────────────────────────
// Parse Structured Sections
// ─────────────────────────────────────────────
function parseStructuredResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  const text = rawText.trim();

  const sections = {
    conditionOverview: '',
    researchInsights: '',
    clinicalTrials: '',
    recommendations: '',
    disclaimer: '',
    rawResponse: text,
  };

  const patterns = [
    { key: 'conditionOverview', re: /1\.\s*CONDITION\s+OVERVIEW[\s\S]*?\n([\s\S]*?)(?=\n2\.|$)/i },
    { key: 'researchInsights',  re: /2\.\s*RESEARCH\s+INSIGHTS[\s\S]*?\n([\s\S]*?)(?=\n3\.|$)/i },
    { key: 'clinicalTrials',    re: /3\.\s*CLINICAL\s+TRIALS[\s\S]*?\n([\s\S]*?)(?=\n4\.|$)/i },
    { key: 'recommendations',   re: /4\.\s*RECOMMENDATIONS[\s\S]*?\n([\s\S]*?)(?=\n5\.|$)/i },
    { key: 'disclaimer',        re: /5\.\s*DISCLAIMER[\s\S]*?\n([\s\S]*?)$/i },
  ];

  for (const { key, re } of patterns) {
    const match = text.match(re);
    if (match && match[1]) {
      sections[key] = match[1].trim().substring(0, 2000);
    }
  }

  if (!sections.conditionOverview && !sections.researchInsights) {
    sections.conditionOverview = text.substring(0, 1500);
  }

  if (!sections.disclaimer) {
    sections.disclaimer =
      'This information is for research and educational purposes only. It does not constitute medical advice. Always consult qualified healthcare professionals.';
  }

  return sections;
}

// ─────────────────────────────────────────────
// Rule-Based Fallback
// ─────────────────────────────────────────────
function cutAtSentence(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  const cut = text.substring(0, maxLen);
  const lastPeriod = cut.lastIndexOf('.');
  return lastPeriod > 50 ? cut.substring(0, lastPeriod + 1) : cut;
}

function generateFallbackResponse({ disease, query, publications, trials }) {
  const pubs = publications || [];
  const trls = trials || [];
  const d = disease || 'the condition';
  const q = query || d;

  const years = pubs.map((p) => p.year).filter(Boolean).sort((a, b) => b - a);
  const newestYear = years[0] || new Date().getFullYear();
  const yearRange = years.length > 1 ? `${years[years.length - 1]}–${newestYear}` : String(newestYear);

  const overviewAbstracts = pubs
    .slice(0, 2)
    .map((p) => p.abstract)
    .filter((a) => a && a.length > 100)
    .map((a) => a.substring(0, 400))
    .join(' ');

  const conditionOverview =
    `${d} is an active area of medical research with ${pubs.length} relevant publications identified ` +
    `from PubMed and OpenAlex (spanning ${yearRange}). ` +
    (overviewAbstracts
      ? `Recent literature highlights: ${cutAtSentence(overviewAbstracts, 1200)}`
      : `Current research focuses on improving diagnostic accuracy, therapeutic outcomes, and patient quality of life.`);

  const insightLines = pubs.slice(0, 6).map((p) => {
    const authors = Array.isArray(p.authors) && p.authors.length
      ? `${p.authors[0]}${p.authors.length > 1 ? ' et al.' : ''}`
      : 'Researchers';
    const rawSnippet = p.abstract ? p.abstract.replace(/\n/g, ' ') : '';
    const snippet = rawSnippet
      ? cutAtSentence(rawSnippet, 250) || rawSnippet.substring(0, 200) + '...'
      : 'See full paper for details.';
    return `• [${p.source === 'pubmed' ? 'PubMed' : 'OpenAlex'}, ${p.year || 'N/A'}] "${p.title?.substring(0, 80) || 'N/A'}" — ${authors}: ${snippet}`;
  });

  const researchInsights = insightLines.length > 0
    ? insightLines.join('\n\n')
    : `No publications found. Try broadening your search terms.`;

  const recruitingTrials = trls.filter((t) => t.status === 'RECRUITING');
  const activeTrials = trls.filter((t) => t.status === 'ACTIVE_NOT_RECRUITING');
  const trialLines = trls.slice(0, 5).map((t) => {
    const loc = t.locations?.length ? `at ${t.locations[0]}` : '';
    const phase = t.phase && t.phase !== 'Not specified' ? ` (${t.phase})` : '';
    return `• [${t.status}${phase}] ${t.title?.substring(0, 80) || 'N/A'} ${loc} — NCT: ${t.nctId}`;
  });

  const clinicalTrials = trls.length > 0
    ? `Found ${trls.length} clinical trials (${recruitingTrials.length} recruiting, ${activeTrials.length} active):\n\n${trialLines.join('\n\n')}\n\nView all trials at clinicaltrials.gov`
    : `No active clinical trials found for "${q}". Check clinicaltrials.gov for the latest.`;

  const sourceCounts = {
    pubmed: pubs.filter((p) => p.source === 'pubmed').length,
    openalex: pubs.filter((p) => p.source === 'openalex').length,
  };

  const recommendations = [
    `• Based on ${pubs.length} publications (${sourceCounts.pubmed} PubMed, ${sourceCounts.openalex} OpenAlex), review the listed papers for detailed insights on "${q}".`,
    recruitingTrials.length > 0
      ? `• ${recruitingTrials.length} actively recruiting trial(s) found — discuss eligibility with your healthcare team.`
      : `• Check ClinicalTrials.gov regularly as new trials for ${d} are frequently added.`,
    `• Focus on publications from ${newestYear - 3}–${newestYear} for the most current treatment protocols.`,
    `• Consult specialists familiar with the latest research, particularly Phase III trials closest to standard of care.`,
  ].join('\n\n');

  return {
    conditionOverview,
    researchInsights,
    clinicalTrials,
    recommendations,
    disclaimer:
      'This information is for research and educational purposes only. It does not constitute medical advice or treatment recommendations. Always consult qualified healthcare professionals.',
    rawResponse: '',
    isFallback: true,
  };
}

// ─────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────
async function generateStructuredResponse({
  disease,
  query,
  patientContext,
  publications,
  trials,
  conversationHistory,
}) {
  console.log(`[LLM] Generating response for: "${disease}" — "${query}"`);

  // ── Tier 1: Groq Llama3 ──
  try {
    const prompt = buildPrompt({ disease, query, publications, trials });
    const rawText = await callGroq(prompt);
    const structured = parseStructuredResponse(rawText);
    if (structured && (structured.conditionOverview || structured.researchInsights)) {
      console.log('[LLM] ✅ Structured response from Groq (Llama3)');
      return { ...structured, isFallback: false, llmSource: 'groq-llama3' };
    }
    console.warn('[LLM] Groq parse produced empty sections, using fallback...');
  } catch (err) {
    console.warn(`[LLM] Groq failed: ${err.message}. Using rule-based fallback.`);
  }

  // ── Tier 2: Rule-based fallback ──
  console.log('[LLM] Using rule-based fallback response.');
  return generateFallbackResponse({ disease, query, publications, trials });
}

module.exports = {
  generateStructuredResponse,
  buildPrompt,
  parseStructuredResponse,
  generateFallbackResponse,
};