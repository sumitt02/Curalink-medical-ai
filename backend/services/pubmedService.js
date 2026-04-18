const axios = require('axios');
const xml2js = require('xml2js');

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const PUBMED_API_KEY = process.env.PUBMED_API_KEY || '';

const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'CuralinkMedicalResearch/1.0 (research@curalink.ai)',
  },
});

/**
 * Parse XML string using xml2js
 */
async function parseXML(xmlString) {
  const parser = new xml2js.Parser({
    explicitArray: true,
    ignoreAttrs: false,
    mergeAttrs: true,
  });
  return parser.parseStringPromise(xmlString);
}

/**
 * Extract text from potentially nested AbstractText elements
 */
function extractAbstractText(abstractTextArr) {
  if (!abstractTextArr || !Array.isArray(abstractTextArr)) return '';

  const parts = abstractTextArr.map((item) => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object') {
      // Handle structured abstracts with labels
      const label = item.Label || item.label || '';
      const text = item._ || item['#text'] || (typeof item === 'string' ? item : '');
      if (label && text) return `${label}: ${text}`;
      return text || '';
    }
    return '';
  });

  return parts.filter(Boolean).join(' ').trim();
}

/**
 * Extract authors from author list XML
 */
function extractAuthors(authorListArr) {
  if (!authorListArr || !Array.isArray(authorListArr)) return [];

  const authors = [];
  for (const authorList of authorListArr) {
    const authorArr = authorList.Author || [];
    for (const author of authorArr.slice(0, 10)) {
      const lastName = author.LastName ? author.LastName[0] : '';
      const foreName = author.ForeName ? author.ForeName[0] : '';
      const initials = author.Initials ? author.Initials[0] : '';
      const collective = author.CollectiveName ? author.CollectiveName[0] : '';

      if (collective) {
        authors.push(collective);
      } else if (lastName) {
        authors.push(foreName ? `${lastName} ${initials || foreName}` : lastName);
      }
    }
  }
  return authors.slice(0, 8);
}

/**
 * Step 1: Search PubMed to get list of PMIDs
 */
async function searchPubMed(query, retmax = 100) {
  const params = {
    db: 'pubmed',
    term: query,
    retmax: retmax,
    retmode: 'json',
    sort: 'relevance',
    usehistory: 'y',
  };

  if (PUBMED_API_KEY) {
    params.api_key = PUBMED_API_KEY;
  }

  const response = await axiosInstance.get(`${BASE_URL}/esearch.fcgi`, { params });
  const data = response.data;

  const idList = data.esearchresult?.idlist || [];
  const webEnv = data.esearchresult?.webenv || '';
  const queryKey = data.esearchresult?.querykey || '';
  const count = parseInt(data.esearchresult?.count || '0', 10);

  return { idList, webEnv, queryKey, count };
}

/**
 * Step 2: Fetch details for given PMIDs
 */
async function fetchPubMedDetails(idList, webEnv, queryKey) {
  if (idList.length === 0) return [];

  const params = {
    db: 'pubmed',
    retmode: 'xml',
    rettype: 'abstract',
    retmax: idList.length,
  };

  if (PUBMED_API_KEY) {
    params.api_key = PUBMED_API_KEY;
  }

  if (webEnv && queryKey) {
    params.WebEnv = webEnv;
    params.query_key = queryKey;
  } else {
    params.id = idList.join(',');
  }

  const response = await axiosInstance.get(`${BASE_URL}/efetch.fcgi`, { params });
  return response.data;
}

/**
 * Parse PubMed XML and extract structured publication data
 */
async function parsePubMedXML(xmlData) {
  const publications = [];

  try {
    const parsed = await parseXML(xmlData);
    const articleSet = parsed.PubmedArticleSet;

    if (!articleSet) return publications;

    const articles = articleSet.PubmedArticle || [];

    for (const article of articles) {
      try {
        const medlineCitation = article.MedlineCitation?.[0];
        if (!medlineCitation) continue;

        const pmid = medlineCitation.PMID?.[0]?._ || medlineCitation.PMID?.[0] || '';
        const articleData = medlineCitation.Article?.[0];
        if (!articleData) continue;

        const title = articleData.ArticleTitle?.[0] || '';
        const cleanTitle = typeof title === 'object' ? title._ || '' : title;

        // Extract abstract
        const abstractContainer = articleData.Abstract?.[0];
        const abstractTextArr = abstractContainer?.AbstractText || [];
        const abstract = extractAbstractText(abstractTextArr);

        // Extract authors
        const authorListArr = articleData.AuthorList || [];
        const authors = extractAuthors(authorListArr);

        // Extract year
        const journal = articleData.Journal?.[0];
        const pubDate = journal?.JournalIssue?.[0]?.PubDate?.[0];
        const year = parseInt(pubDate?.Year?.[0] || pubDate?.MedlineDate?.[0]?.substring(0, 4) || '2000', 10);

        // Extract DOI and other IDs
        const articleIdList = article.PubmedData?.[0]?.ArticleIdList?.[0]?.ArticleId || [];
        let doi = '';
        for (const artId of articleIdList) {
          const idType = artId.IdType || artId.$ ?.IdType || '';
          const idValue = artId._ || artId;
          if (idType === 'doi') {
            doi = typeof idValue === 'string' ? idValue : '';
          }
        }

        // Extract journal name
        const journalTitle =
          journal?.Title?.[0] || journal?.ISOAbbreviation?.[0] || 'Unknown Journal';

        if (cleanTitle && pmid) {
          publications.push({
            title: cleanTitle.trim(),
            abstract: abstract.substring(0, 1500),
            authors,
            year,
            pmid: String(pmid),
            doi,
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            journal: typeof journalTitle === 'string' ? journalTitle : '',
            source: 'pubmed',
            citedByCount: 0,
            relevanceScore: 0.5,
          });
        }
      } catch (articleErr) {
        // Skip individual article parsing errors
      }
    }
  } catch (parseErr) {
    console.error('PubMed XML parse error:', parseErr.message);
  }

  return publications;
}

/**
 * Main PubMed fetch function
 */
async function fetchFromPubMed(query, maxResults = 100) {
  console.log(`[PubMed] Fetching for query: "${query.substring(0, 80)}..."`);

  try {
    const { idList, webEnv, queryKey, count } = await searchPubMed(query, Math.min(maxResults, 200));

    console.log(`[PubMed] Found ${count} results, fetching top ${idList.length}`);

    if (idList.length === 0) {
      return [];
    }

    // Fetch in batches to avoid overwhelming the API
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < idList.length; i += batchSize) {
      batches.push(idList.slice(i, i + batchSize));
    }

    const allPublications = [];

    for (const batch of batches) {
      try {
        const xmlData = await fetchPubMedDetails(batch, '', '');
        const publications = await parsePubMedXML(xmlData);
        allPublications.push(...publications);

        // Respect rate limiting (3 requests/sec without API key, 10/sec with)
        if (batches.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, PUBMED_API_KEY ? 150 : 400));
        }
      } catch (batchErr) {
        console.error(`[PubMed] Batch fetch error:`, batchErr.message);
      }
    }

    console.log(`[PubMed] Successfully parsed ${allPublications.length} publications`);
    return allPublications;
  } catch (error) {
    console.error('[PubMed] Fetch error:', error.message);
    return [];
  }
}

module.exports = { fetchFromPubMed };
