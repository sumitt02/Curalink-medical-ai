const axios = require('axios');

const BASE_URL = 'https://clinicaltrials.gov/api/v2/studies';

const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'CuralinkMedicalResearch/1.0',
    Accept: 'application/json',
  },
});

/**
 * Extract location strings from a study's locations
 */
function extractLocations(locationsArr) {
  if (!Array.isArray(locationsArr)) return [];

  return locationsArr
    .slice(0, 10)
    .map((loc) => {
      const facility = loc.facility || '';
      const city = loc.city || '';
      const state = loc.state || '';
      const country = loc.country || '';
      const parts = [facility, city, state, country].filter(Boolean);
      return parts.join(', ');
    })
    .filter(Boolean);
}

/**
 * Extract contact information from a study
 */
function extractContacts(contactsArr, overallOfficials) {
  const contacts = [];

  if (Array.isArray(contactsArr)) {
    for (const contact of contactsArr.slice(0, 3)) {
      contacts.push({
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        role: contact.role || 'Contact',
      });
    }
  }

  if (Array.isArray(overallOfficials) && contacts.length === 0) {
    for (const official of overallOfficials.slice(0, 2)) {
      contacts.push({
        name: official.name || '',
        email: '',
        phone: '',
        role: official.role || 'Principal Investigator',
      });
    }
  }

  return contacts.filter((c) => c.name);
}

/**
 * Parse a single study from ClinicalTrials v2 API
 */
function parseStudy(study) {
  if (!study) return null;

  const protocolSection = study.protocolSection || {};
  const identificationModule = protocolSection.identificationModule || {};
  const statusModule = protocolSection.statusModule || {};
  const descriptionModule = protocolSection.descriptionModule || {};
  const eligibilityModule = protocolSection.eligibilityModule || {};
  const contactsLocationsModule = protocolSection.contactsLocationsModule || {};
  const designModule = protocolSection.designModule || {};
  const conditionsModule = protocolSection.conditionsModule || {};
  const armsInterventionsModule = protocolSection.armsInterventionsModule || {};

  const nctId = identificationModule.nctId || '';
  const title =
    identificationModule.officialTitle ||
    identificationModule.briefTitle ||
    '';

  if (!nctId || !title) return null;

  const status = statusModule.overallStatus || '';
  const phase = (designModule.phases || []).join(', ') || 'Not specified';
  const conditions = conditionsModule.conditions || [];

  // Eligibility
  const eligibility = eligibilityModule.eligibilityCriteria || '';
  const minAge = eligibilityModule.minimumAge || '';
  const maxAge = eligibilityModule.maximumAge || '';
  const sex = eligibilityModule.sex || '';

  // Locations
  const locationsArr = contactsLocationsModule.locations || [];
  const locations = extractLocations(locationsArr);

  // Contacts
  const centralContacts = contactsLocationsModule.centralContacts || [];
  const overallOfficials = contactsLocationsModule.overallOfficials || [];
  const contacts = extractContacts(centralContacts, overallOfficials);

  // Interventions
  const interventions = (armsInterventionsModule.interventions || [])
    .slice(0, 3)
    .map((i) => `${i.type || ''}: ${i.name || ''}`)
    .filter((i) => i !== ': ');

  // Brief summary
  const briefSummary = descriptionModule.briefSummary || '';

  // Start date
  const startDate = statusModule.startDateStruct?.date || '';

  // Enrollment
  const enrollment = designModule.enrollmentInfo?.count || 0;

  return {
    nctId,
    title: title.trim(),
    status,
    phase,
    conditions,
    briefSummary: briefSummary.substring(0, 800),
    eligibility: eligibility.substring(0, 1000),
    minAge,
    maxAge,
    sex,
    locations: locations.slice(0, 8),
    contacts,
    interventions,
    startDate,
    enrollment: parseInt(enrollment, 10) || 0,
    url: `https://clinicaltrials.gov/study/${nctId}`,
    source: 'clinicaltrials',
    relevanceScore: 0.5,
  };
}

/**
 * Fetch studies from ClinicalTrials.gov v2 API
 */
async function fetchFromClinicalTrials({ condition, location, query }, maxResults = 50) {
  console.log(`[ClinicalTrials] Fetching for condition: "${condition}"`);

  const allStudies = [];

  // Fetch RECRUITING trials
  const recruitingStudies = await fetchStudiesByStatus(
    condition,
    location,
    query,
    'RECRUITING',
    Math.ceil(maxResults * 0.6)
  );
  allStudies.push(...recruitingStudies);

  // Fetch ACTIVE_NOT_RECRUITING trials
  const activeStudies = await fetchStudiesByStatus(
    condition,
    location,
    query,
    'ACTIVE_NOT_RECRUITING',
    Math.ceil(maxResults * 0.4)
  );
  allStudies.push(...activeStudies);

  console.log(`[ClinicalTrials] Returning ${allStudies.length} studies`);
  return allStudies;
}

async function fetchStudiesByStatus(condition, location, query, status, pageSize) {
  const studies = [];

  try {
    // Build URL manually to avoid axios dot-key serialization issues
    // ClinicalTrials v2 requires: filter.overallStatus=RECRUITING (not filter[overallStatus])
    const parts = [];
    parts.push(`format=json`);
    parts.push(`pageSize=${Math.min(pageSize, 100)}`);
    parts.push(`countTotal=true`);
    parts.push(`filter.overallStatus=${encodeURIComponent(status)}`);

    // Use simple disease name for condition query (avoid complex boolean strings)
    const cleanCondition = condition
      ? condition.split(' OR ')[0].trim()  // Take first variant only
      : '';
    if (cleanCondition) {
      parts.push(`query.cond=${encodeURIComponent(cleanCondition)}`);
    }
    if (query) {
      parts.push(`query.term=${encodeURIComponent(query)}`);
    }
    if (location && location.trim() && !['global', 'anywhere', 'worldwide'].includes(location.toLowerCase().trim())) {
      parts.push(`query.locn=${encodeURIComponent(location)}`);
    }

    const url = `${BASE_URL}?${parts.join('&')}`;
    const response = await axiosInstance.get(url);
    const data = response.data;

    const studiesArr = data.studies || [];
    const totalCount = data.totalCount || 0;

    console.log(`[ClinicalTrials] ${status}: ${studiesArr.length} results (total: ${totalCount})`);

    for (const study of studiesArr) {
      const parsed = parseStudy(study);
      if (parsed) {
        studies.push(parsed);
      }
    }
  } catch (error) {
    if (error.response?.status === 400) {
      console.warn(`[ClinicalTrials] Bad request for status ${status}:`, error.response?.data);
    } else {
      console.error(`[ClinicalTrials] Error fetching ${status} studies:`, error.message);
    }
  }

  return studies;
}

module.exports = { fetchFromClinicalTrials };
