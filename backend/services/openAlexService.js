const axios = require('axios');

const BASE_URL = 'https://api.openalex.org/works';

const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'CuralinkMedicalResearch/1.0 (mailto:research@curalink.ai)',
  },
});

/**
 * Reconstruct abstract from OpenAlex's inverted index format
 */
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  try {
    const wordPositions = [];
    for (const [word, positions] of Object.entries(invertedIndex)) {
      for (const pos of positions) {
        wordPositions.push({ word, pos });
      }
    }
    wordPositions.sort((a, b) => a.pos - b.pos);
    const maxPos = Math.max(...wordPositions.map((wp) => wp.pos));
    const words = new Array(maxPos + 1).fill('');
    for (const { word, pos } of wordPositions) {
      words[pos] = word;
    }
    return words.join(' ').trim();
  } catch (err) {
    return '';
  }
}

function extractAuthors(authorships) {
  if (!Array.isArray(authorships)) return [];
  return authorships
    .slice(0, 8)
    .map((a) => a?.author?.display_name || '')
    .filter(Boolean);
}

function parseWork(work) {
  if (!work) return null;
  const title = work.title || '';
  if (!title) return null;

  const abstract = reconstructAbstract(work.abstract_inverted_index);
  const authors = extractAuthors(work.authorships);
  const year = work.publication_year || 2000;
  const doi = work.doi
    ? work.doi.replace('https://doi.org/', '').replace('http://doi.org/', '')
    : '';
  const url =
    work.primary_location?.landing_page_url ||
    (doi ? `https://doi.org/${doi}` : work.id || '');
  const journal = work.primary_location?.source?.display_name || '';

  return {
    title: title.trim(),
    abstract: abstract.substring(0, 1500),
    authors,
    year: parseInt(year, 10),
    doi,
    url,
    journal,
    citedByCount: work.cited_by_count || 0,
    relevanceScore: work.relevance_score || 0,
    concepts: (work.concepts || []).slice(0, 5).map((c) => c.display_name).filter(Boolean),
    openAlexId: work.id || '',
    source: 'openalex',
  };
}

/**
 * Fetch a single page from OpenAlex, building URL manually to avoid param encoding issues
 */
async function fetchPage(query, perPage, page) {
  const encoded = encodeURIComponent(query);
  const selectFields = [
    'id', 'title', 'publication_year', 'doi',
    'abstract_inverted_index', 'authorships', 'cited_by_count',
    'relevance_score', 'primary_location', 'concepts',
  ].join(',');

  const url =
    `${BASE_URL}?search=${encoded}` +
    `&per-page=${perPage}` +
    `&page=${page}` +
    `&sort=relevance_score:desc` +
    `&select=${encodeURIComponent(selectFields)}`;

  const response = await axiosInstance.get(url);
  return response.data;
}

async function fetchFromOpenAlex(query, maxResults = 200) {
  console.log(`[OpenAlex] Fetching for query: "${query.substring(0, 80)}"`);
  const allWorks = [];
  const perPage = Math.min(maxResults, 200);

  try {
    const data = await fetchPage(query, perPage, 1);
    const results = data.results || [];
    const totalCount = data.meta?.count || 0;
    console.log(`[OpenAlex] Page 1: ${results.length} results (total available: ${totalCount})`);

    for (const work of results) {
      const parsed = parseWork(work);
      if (parsed) allWorks.push(parsed);
    }

    // Fetch page 2 if needed and available
    if (maxResults > 200 && totalCount > 200 && results.length === perPage) {
      try {
        const data2 = await fetchPage(query, perPage, 2);
        const results2 = data2.results || [];
        console.log(`[OpenAlex] Page 2: ${results2.length} results`);
        for (const work of results2) {
          const parsed = parseWork(work);
          if (parsed) allWorks.push(parsed);
        }
      } catch (page2Err) {
        console.warn('[OpenAlex] Page 2 fetch failed:', page2Err.message);
      }
    }
  } catch (error) {
    if (error.response?.status === 429) {
      console.error('[OpenAlex] Rate limited (429). Skipping.');
    } else if (error.response?.status === 400) {
      console.error('[OpenAlex] Bad request (400). Retrying with simpler query...');
      // Retry with just the first 3 words
      try {
        const simpleQuery = query.split(' ').slice(0, 4).join(' ');
        const data = await fetchPage(simpleQuery, Math.min(perPage, 25), 1);
        const results = data.results || [];
        console.log(`[OpenAlex] Simple retry: ${results.length} results`);
        for (const work of results) {
          const parsed = parseWork(work);
          if (parsed) allWorks.push(parsed);
        }
      } catch (retryErr) {
        console.error('[OpenAlex] Retry also failed:', retryErr.message);
      }
    } else {
      console.error('[OpenAlex] Fetch error:', error.message);
    }
  }

  console.log(`[OpenAlex] Returning ${allWorks.length} works`);
  return allWorks;
}

module.exports = { fetchFromOpenAlex };
