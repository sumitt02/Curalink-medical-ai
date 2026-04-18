const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    publications: [
      {
        title: String,
        authors: [String],
        year: Number,
        pmid: String,
        doi: String,
        url: String,
        abstract: String,
        source: String,
        citedByCount: Number,
        relevanceScore: Number,
        finalScore: Number,
      },
    ],
    trials: [
      {
        nctId: String,
        title: String,
        status: String,
        phase: String,
        conditions: [String],
        eligibility: String,
        locations: [String],
        contacts: [
          {
            name: String,
            email: String,
            phone: String,
          },
        ],
        url: String,
        relevanceScore: Number,
      },
    ],
  },
});

const ConversationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    messages: [MessageSchema],
    disease: {
      type: String,
      default: '',
    },
    patientContext: {
      patientName: { type: String, default: '' },
      location: { type: String, default: '' },
      age: { type: String, default: '' },
      additionalContext: { type: String, default: '' },
    },
    totalTurns: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

ConversationSchema.methods.addMessage = function (role, content, metadata = null) {
  const msg = { role, content, timestamp: new Date() };
  if (metadata) {
    msg.metadata = metadata;
  }
  this.messages.push(msg);
  if (role === 'user') {
    this.totalTurns += 1;
  }
  return this;
};

ConversationSchema.methods.getRecentHistory = function (turns = 5) {
  const userAssistantMessages = this.messages.filter(
    (m) => m.role === 'user' || m.role === 'assistant'
  );
  return userAssistantMessages.slice(-turns * 2);
};

module.exports = mongoose.model('Conversation', ConversationSchema);
