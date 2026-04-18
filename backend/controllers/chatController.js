const { v4: uuidv4 } = require('uuid');
const Conversation = require('../models/Conversation');
const { expandQuery } = require('../services/queryExpansion');
const { fetchFromPubMed } = require('../services/pubmedService');
const { fetchFromOpenAlex } = require('../services/openAlexService');
const { fetchFromClinicalTrials } = require('../services/clinicalTrialsService');
const { rankPublications, rankTrials } = require('../services/rankingService');
const { generateStructuredResponse } = require('../services/llmService');

// ─────────────────────────────────────────────
// Strip [Patient: ...] [Disease: ...] (Location: ...) tags from message
// These are added by the structured form but should NOT go into search queries
// ─────────────────────────────────────────────
function extractCleanQuery(message) {
  if (!message) return '';
  // Remove [Key: value] patterns and (Key: value) patterns
  return message
    .replace(/\[Patient:[^\]]*\]/gi, '')
    .replace(/\[Disease:[^\]]*\]/gi, '')
    .replace(/\(Location preference:[^)]*\)/gi, '')
    .replace(/\[Location:[^\]]*\]/gi, '')
    .trim();
}

// ─────────────────────────────────────────────
// Safely get or create a conversation session
// ─────────────────────────────────────────────
async function getOrCreateSession(sessionId, disease, patientContext) {
  let conversation = null;

  try {
    conversation = await Conversation.findOne({ sessionId });

    if (!conversation) {
      conversation = new Conversation({
        sessionId,
        messages: [],
        disease: disease || '',
        patientContext: patientContext || {},
      });
    } else {
      if (disease) conversation.disease = disease;
      if (patientContext && Object.keys(patientContext).length > 0) {
        conversation.patientContext = {
          ...conversation.patientContext.toObject?.() || conversation.patientContext,
          ...patientContext,
        };
      }
    }
  } catch (err) {
    console.error('[Session] MongoDB error, using in-memory session:', err.message);
    conversation = {
      sessionId,
      messages: [],
      disease: disease || '',
      patientContext: patientContext || {},
      totalTurns: 0,
      getRecentHistory: function (turns = 5) {
        const userAssistant = this.messages.filter(
          (m) => m.role === 'user' || m.role === 'assistant'
        );
        return userAssistant.slice(-turns * 2);
      },
      addMessage: function (role, content, metadata) {
        this.messages.push({ role, content, timestamp: new Date(), metadata });
        if (role === 'user') this.totalTurns += 1;
        return this;
      },
      save: async function () {
        return this;
      },
    };
  }

  return conversation;
}

// ─────────────────────────────────────────────
// POST /api/chat
// ─────────────────────────────────────────────
const chat = async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      sessionId: providedSessionId,
      message,
      disease,
      patientName,
      location,
      patientContext: providedPatientContext,
      isStructured = true,
    } = req.body;

    if (!message && !disease) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Either message or disease is required',
      });
    }

    const sessionId = providedSessionId || uuidv4();

    const patientContext = providedPatientContext || {
      patientName: patientName || '',
      location: location || '',
    };

    // ── Clean the query — remove [Patient:...] [Disease:...] tags ──
    // The structured form puts patient/disease info into the message string.
    // We must strip these before sending to search APIs, otherwise "john smith"
    // ends up as a medical search keyword and returns irrelevant papers.
    const cleanQuery = extractCleanQuery(message);

    console.log(`\n[Chat] Session: ${sessionId}`);
    console.log(`[Chat] Disease: ${disease}`);
    console.log(`[Chat] Raw message: "${message?.substring(0, 80)}"`);
    console.log(`[Chat] Clean query for APIs: "${cleanQuery}"`);

    const conversation = await getOrCreateSession(sessionId, disease, patientContext);
    const conversationHistory = conversation.getRecentHistory(5);

    // Use cleanQuery for API searches — NOT the raw message
    const expandedQueries = expandQuery({
      disease: disease || '',
      query: cleanQuery,
      location: patientContext.location || '',
    });

    console.log(`[Chat] Expanded queries ready`);

    // Save original message (with patient info) to conversation history
    conversation.addMessage('user', message || disease, null);

    // ── Parallel API fetching ──
    console.log('[Chat] Starting parallel API fetches...');

    const [pubmedResult, openAlexResult, clinicalTrialsResult] = await Promise.allSettled([
      fetchFromPubMed(expandedQueries.pubmed, 100),
      fetchFromOpenAlex(expandedQueries.openAlex, 200),
      fetchFromClinicalTrials(expandedQueries.clinicalTrials, 50),
    ]);

    const pubmedPublications =
      pubmedResult.status === 'fulfilled' ? pubmedResult.value : [];
    const openAlexPublications =
      openAlexResult.status === 'fulfilled' ? openAlexResult.value : [];
    const rawTrials =
      clinicalTrialsResult.status === 'fulfilled' ? clinicalTrialsResult.value : [];

    if (pubmedResult.status === 'rejected') {
      console.error('[Chat] PubMed fetch failed:', pubmedResult.reason?.message);
    }
    if (openAlexResult.status === 'rejected') {
      console.error('[Chat] OpenAlex fetch failed:', openAlexResult.reason?.message);
    }
    if (clinicalTrialsResult.status === 'rejected') {
      console.error('[Chat] ClinicalTrials fetch failed:', clinicalTrialsResult.reason?.message);
    }

    console.log(
      `[Chat] Raw results - PubMed: ${pubmedPublications.length}, OpenAlex: ${openAlexPublications.length}, Trials: ${rawTrials.length}`
    );

    // ── Ranking ──
    const allPublications = [...pubmedPublications, ...openAlexPublications];
    const rankedPublications = rankPublications(allPublications, 8);
    const rankedTrials = rankTrials(rawTrials, 5);

    console.log(
      `[Chat] Ranked - Publications: ${rankedPublications.length}, Trials: ${rankedTrials.length}`
    );

    // ── LLM response — pass cleanQuery so LLM focuses on medical topic ──
    const llmResponse = await generateStructuredResponse({
      disease: disease || '',
      query: cleanQuery || disease || '',
      patientContext,
      publications: rankedPublications,
      trials: rankedTrials,
      conversationHistory,
    });

    // ── Save to MongoDB ──
    const assistantContent = llmResponse.conditionOverview
      ? `${llmResponse.conditionOverview}\n\n${llmResponse.researchInsights}\n\n${llmResponse.recommendations}`
      : llmResponse.rawResponse || 'Research analysis complete.';

    conversation.addMessage('assistant', assistantContent, {
      publications: rankedPublications.slice(0, 6),
      trials: rankedTrials.slice(0, 4),
    });

    try {
      await conversation.save();
    } catch (saveErr) {
      console.error('[Chat] Failed to save conversation:', saveErr.message);
    }

    // ── Build response ──
    const processingTime = Date.now() - startTime;

    const response = {
      sessionId,
      success: true,
      processingTime: `${processingTime}ms`,
      query: {
        disease: disease || '',
        message: cleanQuery || '',
        location: patientContext.location || '',
      },
      stats: {
        pubmedCount: pubmedPublications.length,
        openAlexCount: openAlexPublications.length,
        trialsCount: rawTrials.length,
        rankedPublications: rankedPublications.length,
        rankedTrials: rankedTrials.length,
      },
      llmResponse: {
        conditionOverview: llmResponse.conditionOverview || '',
        researchInsights: llmResponse.researchInsights || '',
        clinicalTrials: llmResponse.clinicalTrials || '',
        recommendations: llmResponse.recommendations || '',
        disclaimer: llmResponse.disclaimer || '',
        isFallback: llmResponse.isFallback || false,
        llmSource: llmResponse.llmSource || 'fallback',
      },
      publications: rankedPublications.map((pub) => ({
        title: pub.title || '',
        authors: pub.authors || [],
        year: pub.year || null,
        abstract: pub.abstract || '',
        source: pub.source || '',
        url: pub.url || '',
        pmid: pub.pmid || null,
        doi: pub.doi || null,
        journal: pub.journal || '',
        citedByCount: pub.citedByCount || 0,
        relevanceScore: pub.relevanceScore || 0,
        finalScore: pub.finalScore || 0,
      })),
      trials: rankedTrials.map((trial) => ({
        nctId: trial.nctId || '',
        title: trial.title || '',
        status: trial.status || '',
        phase: trial.phase || '',
        conditions: trial.conditions || [],
        briefSummary: trial.briefSummary || '',
        eligibility: trial.eligibility || '',
        locations: trial.locations || [],
        contacts: trial.contacts || [],
        interventions: trial.interventions || [],
        url: trial.url || '',
        enrollment: trial.enrollment || 0,
      })),
      apiStatus: {
        pubmed: pubmedResult.status === 'fulfilled' ? 'success' : 'failed',
        openAlex: openAlexResult.status === 'fulfilled' ? 'success' : 'failed',
        clinicalTrials: clinicalTrialsResult.status === 'fulfilled' ? 'success' : 'failed',
      },
    };

    console.log(`[Chat] Response ready in ${processingTime}ms`);
    return res.status(200).json(response);

  } catch (error) {
    console.error('[Chat] Unhandled error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
      success: false,
    });
  }
};

// POST /api/research — alias for chat
const research = async (req, res) => {
  req.body.isStructured = true;
  return chat(req, res);
};

// GET /api/sessions/:sessionId/history
const getSessionHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'sessionId is required',
      });
    }

    const conversation = await Conversation.findOne({ sessionId });

    if (!conversation) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No session found with ID: ${sessionId}`,
        sessionId,
        messages: [],
      });
    }

    const messages = conversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      hasMetadata: !!(msg.metadata?.publications?.length || msg.metadata?.trials?.length),
      publicationCount: msg.metadata?.publications?.length || 0,
      trialCount: msg.metadata?.trials?.length || 0,
    }));

    return res.status(200).json({
      sessionId,
      disease: conversation.disease || '',
      patientContext: conversation.patientContext || {},
      totalTurns: conversation.totalTurns || 0,
      messageCount: messages.length,
      messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    console.error('[History] Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to retrieve session history',
    });
  }
};

// GET /api/sessions
const listSessions = async (req, res) => {
  try {
    const sessions = await Conversation.find(
      {},
      { sessionId: 1, disease: 1, totalTurns: 1, createdAt: 1, updatedAt: 1 }
    )
      .sort({ updatedAt: -1 })
      .limit(50);

    return res.status(200).json({
      count: sessions.length,
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        disease: s.disease,
        totalTurns: s.totalTurns,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[Sessions] Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
};

module.exports = { chat, research, getSessionHistory, listSessions };