/**
 * 外部API型定義
 * Purpose: OpenAI、その他外部サービスとの連携型
 */

import { Message, FAQ } from './database';

// ===================
// OpenAI API Types
// ===================

export interface OpenAIRequest {
  prompt: string;
  sessionData: SessionData;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface SessionData {
  sessionToken: string;
  mode: 'roadmap' | 'step_by_step';
  currentStep: string;
  currentCarrier?: string;
  targetCarrier?: string;
  conversation?: Message[];
  lastQuery?: string;
  preferences?: Record<string, any>;
}

export interface OpenAIResponse {
  message: string;
  suggestions: string[];
  actions: Array<{
    type: 'button' | 'link' | 'escalation';
    label: string;
    value: string;
    url?: string;
  }>;
  needsEscalation?: boolean;
  confidence?: number;
}

export interface ChatResponse extends OpenAIResponse {
  escalation?: {
    reason: string;
    lineUrl: string;
    contextData: {
      lastQuery: string;
      currentStep: string;
      conversation: Message[];
    };
  };
}

// ===================
// RAG Search Types
// ===================

export interface RAGSearchResult {
  faqs: FAQ[];
  similarityScores: number[];
  contextRelevance: number;
}

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ===================
// Scenario Service Types
// ===================

export interface ScenarioStep {
  id: string;
  name: string;
  description: string;
  type: 'information' | 'action' | 'confirmation';
  requirements: string[];
  nextSteps: string[];
  estimatedTime: number;
  troubleshooting?: TroubleshootingInfo[];
}

export interface TroubleshootingInfo {
  problem: string;
  solution: string;
  relatedFAQs: string[];
}

export interface RoadmapData {
  steps: ScenarioStep[];
  currentStep: string;
  progress: number;
  estimatedTotalTime: number;
  carrierSpecific: {
    [carrier: string]: {
      specificSteps?: ScenarioStep[];
      requirements?: string[];
      warnings?: string[];
    };
  };
}

// ===================
// Escalation Service Types
// ===================

export interface EscalationRule {
  id: string;
  condition: 'confidence_threshold' | 'keyword_match' | 'conversation_length' | 'user_request';
  threshold?: number;
  keywords?: string[];
  priority: 'low' | 'medium' | 'high';
  autoEscalate: boolean;
  description: string;
}

export interface EscalationContext {
  sessionData: SessionData;
  conversationLength: number;
  lastConfidenceScore?: number;
  detectedKeywords: string[];
  userFrustrationLevel: number;
  previousEscalations: number;
}

// ===================
// External Service Integration
// ===================

export interface LineAPIConfig {
  channelToken: string;
  channelSecret: string;
  webhookUrl: string;
  richmenuId?: string;
}

export interface LineWebhookEvent {
  type: string;
  timestamp: number;
  source: {
    type: 'user' | 'group' | 'room';
    userId: string;
  };
  message?: {
    type: 'text' | 'image' | 'sticker';
    text?: string;
    id: string;
  };
  replyToken: string;
}

// ===================
// Monitoring and Analytics
// ===================

export interface ConversationMetrics {
  sessionDuration: number;
  messageCount: number;
  averageResponseTime: number;
  satisfactionScore?: number;
  escalationOccurred: boolean;
  completionStatus: 'completed' | 'abandoned' | 'escalated';
  errorCount: number;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  errorRate: number;
  lastChecked: Date;
  details?: {
    database: boolean;
    openai: boolean;
    redis: boolean;
    externalAPIs: boolean;
  };
}

// ===================
// Configuration Types
// ===================

export interface AIServiceConfig {
  openaiApiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  retryAttempts: number;
  timeoutMs: number;
}

export interface RAGConfig {
  maxResults: number;
  relevanceThreshold: number;
  vectorSimilarityWeight: number;
  keywordMatchWeight: number;
  contextBoostEnabled: boolean;
}

export interface EscalationConfig {
  autoEscalationEnabled: boolean;
  confidenceThreshold: number;
  maxConversationLength: number;
  frustrationDetectionEnabled: boolean;
  lineIntegrationEnabled: boolean;
}
