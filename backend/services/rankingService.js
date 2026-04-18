/**
 * Ranking Service
 * Scores, deduplicates, and ranks publications and clinical trials
 */

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Compute recency score (1.0 for current year, linear decay ~0.05/year)
 */
function computeRecencyScore(year) {
  if (!year || isNaN(year)) return 0.3;
  const age = CURRENT_YEAR - parseInt(year, 10);
  if (age < 0) return 1.0;
  if (age === 0) return 1.0;
  // Decay: each year reduces score by 0.07, floor at 0.1
  return Math.max(0.1, 1.0 - age * 0.07);
}

/**
 * Compute citation score using log normalization
 * Normalized relative to a reference of 1000 citations = score 1.0
 */
function computeCitationScore(citedByCount) {
  if (!citedByCount || citedByCount <= 0) return 0.1;
  // log(1001) ≈ 6.91, so normalize to [0, 1]
  return Math.min(1.0, Math.log(citedByCount + 1) / Math.log(1001));
}

/**
 * Compute relevance score (normalize from API-provided scores)
 */
function normalizeRelevanceScore(score) {
  if (!score || isNaN(score)) return 0.3;
  // OpenAlex relevance scores can be large numbers, normalize to [0, 1]
  if (score > 1) {
    // OpenAlex uses BM25-like scores, cap at 100 for normalization
    return Math.min(1.0, score / 100);
  }
  return Math.max(0, Math.min(1.0, score));
}

/**
 * Compute final weighted score for a publication
 * Score = relevance*0.4 + recency*0.3 + citation*0.3
 */
function scorePublication(pub) {
  const relevanceScore = normalizeRelevanceScore(pub.relevanceScore || 0.5);
  const recencyScore = computeRecencyScore(pub.year);
  const citationScore = computeCitationScore(pub.citedByCount || 0);

  const finalScore =
    relevanceScore * 0.4 + recencyScore * 0.3 + citationScore * 0.3;

  return {
    ...pub,
    relevanceScore,
    recencyScore,
    citationScore,
    finalScore: Math.round(finalScore * 1000) / 1000,
  };
}

/**
 * Simple string similarity for deduplication (Jaccard on word sets)
 */
function titleSimilarity(title1, title2) {
  if (!title1 || !title2) return 0;

  const words1 = new Set(
    title1
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const words2 = new Set(
    title2
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Deduplicate publications by title similarity
 * Keeps the version with the higher final score
 */
function deduplicatePublications(publications, similarityThreshold = 0.75) {
  const unique = [];

  for (const pub of publications) {
    let isDuplicate = false;

    for (let i = 0; i < unique.length; i++) {
      const similarity = titleSimilarity(pub.title, unique[i].title);
      if (similarity >= similarityThreshold) {
        // Keep the one with higher score or more citations
        if ((pub.finalScore || 0) > (unique[i].finalScore || 0)) {
          unique[i] = pub;
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(pub);
    }
  }

  return unique;
}

/**
 * Rank publications from multiple sources
 * Combines PubMed + OpenAlex results, deduplicates, and returns top N
 */
function rankPublications(publications, topN = 8) {
  if (!publications || publications.length === 0) return [];

  // Score all publications
  const scored = publications
    .filter((pub) => pub && pub.title)
    .map(scorePublication);

  // Sort by final score descending
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Deduplicate
  const unique = deduplicatePublications(scored);

  // Ensure diversity: try to have at least 1 PubMed and 1 OpenAlex result if available
  const pubmedResults = unique.filter((p) => p.source === 'pubmed');
  const openAlexResults = unique.filter((p) => p.source === 'openalex');

  let ranked = unique.slice(0, topN);

  // If we don't have enough diversity, ensure at least 2 from each source if available
  if (pubmedResults.length > 0 && openAlexResults.length > 0) {
    const inTop = ranked.reduce(
      (acc, p) => {
        acc[p.source] = (acc[p.source] || 0) + 1;
        return acc;
      },
      {}
    );

    if (!inTop.pubmed && pubmedResults.length > 0) {
      ranked = [...ranked.slice(0, topN - 1), pubmedResults[0]];
    }
    if (!inTop.openalex && openAlexResults.length > 0) {
      ranked = [...ranked.slice(0, topN - 1), openAlexResults[0]];
    }
  }

  // Clean up internal scoring fields for output but keep them for transparency
  return ranked.slice(0, topN).map((pub) => {
    const cleaned = { ...pub };
    // Remove null/undefined fields
    Object.keys(cleaned).forEach((key) => {
      if (cleaned[key] === null || cleaned[key] === undefined || cleaned[key] === '') {
        delete cleaned[key];
      }
    });
    return cleaned;
  });
}

/**
 * Score a clinical trial based on status and relevance
 */
function scoreTrial(trial) {
  let statusScore = 0;
  switch (trial.status) {
    case 'RECRUITING':
      statusScore = 1.0;
      break;
    case 'ACTIVE_NOT_RECRUITING':
      statusScore = 0.7;
      break;
    case 'COMPLETED':
      statusScore = 0.4;
      break;
    case 'NOT_YET_RECRUITING':
      statusScore = 0.5;
      break;
    default:
      statusScore = 0.2;
  }

  const relevanceScore = normalizeRelevanceScore(trial.relevanceScore || 0.5);
  const finalScore = relevanceScore * 0.5 + statusScore * 0.5;

  return {
    ...trial,
    finalScore: Math.round(finalScore * 1000) / 1000,
  };
}

/**
 * Rank clinical trials
 */
function rankTrials(trials, topN = 5) {
  if (!trials || trials.length === 0) return [];

  const scored = trials.filter((t) => t && t.nctId).map(scoreTrial);

  // Sort: RECRUITING first, then by score
  scored.sort((a, b) => {
    if (a.status === 'RECRUITING' && b.status !== 'RECRUITING') return -1;
    if (b.status === 'RECRUITING' && a.status !== 'RECRUITING') return 1;
    return b.finalScore - a.finalScore;
  });

  // Deduplicate by NCT ID
  const seenNctIds = new Set();
  const unique = scored.filter((trial) => {
    if (seenNctIds.has(trial.nctId)) return false;
    seenNctIds.add(trial.nctId);
    return true;
  });

  return unique.slice(0, topN).map((trial) => {
    const cleaned = { ...trial };
    Object.keys(cleaned).forEach((key) => {
      if (cleaned[key] === null || cleaned[key] === undefined || cleaned[key] === '') {
        delete cleaned[key];
      }
    });
    return cleaned;
  });
}

module.exports = {
  rankPublications,
  rankTrials,
  scorePublication,
  scoreTrial,
  computeRecencyScore,
  computeCitationScore,
};
