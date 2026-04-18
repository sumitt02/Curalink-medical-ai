/**
 * Query Expansion Service
 * Intelligently expands medical queries for different APIs
 */

const MEDICAL_SYNONYMS = {
  cancer: ['carcinoma', 'tumor', 'malignancy', 'neoplasm', 'oncology'],
  diabetes: ['diabetes mellitus', 'hyperglycemia', 'insulin resistance', 'T2DM', 'T1DM'],
  alzheimer: ["alzheimer's disease", 'dementia', 'cognitive decline', 'neurodegeneration'],
  hypertension: ['high blood pressure', 'arterial hypertension', 'cardiovascular disease'],
  depression: ['major depressive disorder', 'MDD', 'mental health', 'antidepressant'],
  asthma: ['bronchial asthma', 'airway inflammation', 'bronchospasm', 'respiratory disease'],
  arthritis: ['rheumatoid arthritis', 'RA', 'joint inflammation', 'autoimmune disease'],
  parkinson: ["parkinson's disease", 'PD', 'dopaminergic', 'motor dysfunction'],
  stroke: ['cerebrovascular accident', 'CVA', 'ischemic stroke', 'hemorrhagic stroke'],
  heart: ['cardiac', 'cardiovascular', 'coronary', 'myocardial'],
  covid: ['COVID-19', 'SARS-CoV-2', 'coronavirus', 'long covid'],
  hiv: ['HIV', 'AIDS', 'antiretroviral', 'immunodeficiency'],
  lupus: ['systemic lupus erythematosus', 'SLE', 'autoimmune'],
  multiple_sclerosis: ['multiple sclerosis', 'MS', 'demyelinating disease'],
  copd: ['chronic obstructive pulmonary disease', 'emphysema', 'chronic bronchitis'],
};

const INTENT_QUERY_MAP = {
  treatment: ['treatment', 'therapy', 'intervention', 'management', 'therapeutic'],
  diagnosis: ['diagnosis', 'diagnostic', 'biomarker', 'screening', 'detection'],
  prevention: ['prevention', 'prophylaxis', 'risk reduction', 'preventive'],
  symptoms: ['symptoms', 'clinical manifestations', 'signs', 'presentation'],
  prognosis: ['prognosis', 'outcomes', 'survival', 'mortality', 'progression'],
  mechanism: ['mechanism', 'pathophysiology', 'molecular', 'pathway', 'etiology'],
  drug: ['drug', 'medication', 'pharmacotherapy', 'clinical trial', 'efficacy'],
  surgery: ['surgery', 'surgical', 'operative', 'procedure', 'intervention'],
  genetics: ['genetics', 'genomics', 'mutation', 'gene expression', 'hereditary'],
  immunology: ['immunology', 'immune response', 'inflammation', 'cytokine', 'antibody'],
};

/**
 * Expand a disease term with synonyms
 */
function expandDiseaseTerm(disease) {
  if (!disease) return [];

  const diseaseLower = disease.toLowerCase().trim();
  const synonyms = [disease];

  for (const [key, values] of Object.entries(MEDICAL_SYNONYMS)) {
    if (diseaseLower.includes(key) || key.includes(diseaseLower)) {
      synonyms.push(...values);
      break;
    }
  }

  return [...new Set(synonyms)];
}

/**
 * Extract intent keywords from a natural language query
 */
function extractIntentKeywords(query) {
  if (!query) return [];

  const queryLower = query.toLowerCase();
  const intentKeywords = [];

  for (const [intent, keywords] of Object.entries(INTENT_QUERY_MAP)) {
    if (keywords.some((kw) => queryLower.includes(kw))) {
      intentKeywords.push(...keywords.slice(0, 2));
    }
  }

  return [...new Set(intentKeywords)];
}

// Common English stop words to strip from queries
const STOP_WORDS = new Set([
  'what', 'are', 'the', 'latest', 'recent', 'new', 'current', 'best',
  'how', 'does', 'is', 'for', 'in', 'of', 'and', 'or', 'a', 'an',
  'to', 'with', 'about', 'on', 'can', 'could', 'would', 'should',
  'most', 'top', 'show', 'me', 'give', 'find', 'tell', 'list',
  'clinical', 'patients', 'patient', 'people', 'trials', 'studies',
  'research', 'researchers', 'study', 'information', 'data', 'options',
]);

/**
 * Extract clean medical keywords from a natural language query.
 * Removes stop words and common English words, keeps medically relevant terms.
 */
function extractMedicalKeywords(query, disease) {
  if (!query) return [];
  const diseaseLower = (disease || '').toLowerCase();

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => {
      if (w.length < 3) return false;
      if (STOP_WORDS.has(w)) return false;
      // Skip words already covered by the disease term
      if (diseaseLower && diseaseLower.includes(w)) return false;
      return true;
    })
    .slice(0, 4); // Max 4 keywords
}

/**
 * Build PubMed-optimized query using MeSH-style boolean operators.
 * Uses only short, clean keyword terms to avoid zero-result queries.
 */
function buildPubMedQuery(disease, query, location) {
  const diseaseTerms = expandDiseaseTerm(disease);
  const primaryDisease = diseaseTerms[0];

  // Extract meaningful medical keywords from the query
  const intentKws = extractIntentKeywords(query);
  const medicalKws = extractMedicalKeywords(query, primaryDisease);

  let pubmedQuery = '';

  if (primaryDisease) {
    pubmedQuery = `(${primaryDisease}[Title/Abstract])`;

    // Add up to 2 focused keyword terms (intent-first, then medical keywords)
    const additionalTerms = [...new Set([...intentKws.slice(0, 1), ...medicalKws.slice(0, 2)])]
      .filter((kw) => kw && kw.length > 2 && kw.toLowerCase() !== primaryDisease.toLowerCase())
      .slice(0, 2);

    if (additionalTerms.length > 0) {
      const termQuery = additionalTerms.map((t) => `${t}[Title/Abstract]`).join(' OR ');
      pubmedQuery += ` AND (${termQuery})`;
    }
  } else if (query) {
    // No disease: build from keywords only
    const kws = extractMedicalKeywords(query, '').slice(0, 3);
    pubmedQuery = kws.length > 0
      ? kws.map((k) => `${k}[Title/Abstract]`).join(' AND ')
      : query.split(' ').slice(0, 3).join(' AND ');
  }

  // Add date filter for recent publications (last 10 years)
  pubmedQuery += ' AND ("2014"[Date - Publication] : "3000"[Date - Publication])';

  return pubmedQuery;
}

/**
 * Build OpenAlex-optimized query
 */
function buildOpenAlexQuery(disease, query, location) {
  const diseaseTerms = expandDiseaseTerm(disease);
  const terms = [];

  if (diseaseTerms.length > 0) {
    terms.push(diseaseTerms[0]);
  }

  if (query) {
    // Extract key phrases from query
    const cleanQuery = query
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(' ')
      .filter((w) => w.length > 3)
      .slice(0, 5)
      .join(' ');
    if (cleanQuery) {
      terms.push(cleanQuery);
    }
  }

  return terms.join(' ');
}

/**
 * Build ClinicalTrials.gov query
 */
function buildClinicalTrialsQuery(disease, query, location) {
  const diseaseTerms = expandDiseaseTerm(disease);
  const primaryDisease = diseaseTerms[0] || '';

  let conditionQuery = primaryDisease;
  if (diseaseTerms.length > 1) {
    conditionQuery = diseaseTerms.slice(0, 3).join(' OR ');
  }

  return {
    condition: conditionQuery,
    location: location || '',
    query: query || '',
  };
}

/**
 * Main query expansion function
 * Returns expanded queries for each API
 */
function expandQuery({ disease, query, location }) {
  const pubmedQuery = buildPubMedQuery(disease, query, location);
  const openAlexQuery = buildOpenAlexQuery(disease, query, location);
  const clinicalTrialsParams = buildClinicalTrialsQuery(disease, query, location);

  const diseaseVariants = expandDiseaseTerm(disease);
  const intentKeywords = extractIntentKeywords(query);

  return {
    pubmed: pubmedQuery,
    openAlex: openAlexQuery,
    clinicalTrials: clinicalTrialsParams,
    diseaseVariants,
    intentKeywords,
    originalDisease: disease || '',
    originalQuery: query || '',
  };
}

module.exports = {
  expandQuery,
  expandDiseaseTerm,
  extractIntentKeywords,
  buildPubMedQuery,
  buildOpenAlexQuery,
  buildClinicalTrialsQuery,
};
