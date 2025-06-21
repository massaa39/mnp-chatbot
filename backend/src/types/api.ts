/**
 * API型定義
 * Purpose: REST APIのリクエスト・レスポンス型定義
 */

import { User, ChatSession, Message, FAQ } from './database';

// ===================
// Transformed Types for API Responses
// ===================

export interface UserInfo {
  sessionId: string;
  phoneNumber?: string;
  currentCarrier?: string;
  targetCarrier?: string;
  status: 'active' | 'completed' | 'escalated';
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionInfo {
  sessionToken: string;
  mode: 'roadmap' | 'step_by_step';
  currentStep: string;
  scenarioData: Record<string, any>;
  contextData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ===================
// Chat API Types
// ===================

export interface ChatRequest {
  message: string;
  sessionToken?: string;
  mode?: 'roadmap' | 'step_by_step';
  contextData?: Record<string, any>;
}

export interface ChatResponse {
  message: string;
  sessionToken: string;
  suggestions: string[];
  actions: ChatAction[];
  currentStep?: string;
  needsEscalation?: boolean;
  escalation?: EscalationInfo;
  metadata?: {
    responseTime: number;
    confidenceScore?: number;
    ragResults?: number;
  };
}

export interface ChatAction {
  type: 'button' | 'link' | 'escalation' | 'quick_reply';
  label: string;
  value: string;
  url?: string;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface EscalationInfo {
  reason: string;
  lineUrl: string;
  contextData: {
    lastQuery: string;
    currentStep: string;
    conversation: Message[];
  };
}

// ===================
// Session API Types
// ===================

export interface CreateSessionRequest {
  phoneNumber?: string;
  currentCarrier?: string;
  targetCarrier?: string;
  mode: 'roadmap' | 'step_by_step';
  preferences?: Record<string, any>;
}

export interface CreateSessionResponse {
  sessionToken: string;
  user: UserInfo;
  session: SessionInfo;
}

export interface GetHistoryResponse {
  messages: Message[];
  session: SessionInfo;
  user: UserInfo;
  pagination: PaginationResponse;
}

// ===================
// FAQ API Types
// ===================

export interface GetFAQsResponse {
  faqs: FAQ[];
  categories: string[];
  pagination: PaginationResponse;
}

export interface SearchFAQsRequest {
  query: string;
  category?: string;
  carrierSpecific?: string;
  limit?: number;
}

export interface SearchFAQsResponse {
  faqs: FAQ[];
  searchMetadata: {
    query: string;
    resultsCount: number;
    searchTime: number;
    relevanceThreshold: number;
  };
}

// ===================
// Escalation API Types
// ===================

export interface EscalationRequest {
  sessionToken: string;
  reason: string;
  urgencyLevel: 'low' | 'medium' | 'high';
  customerInfo: {
    name?: string;
    email?: string;
    preferredContact: 'line' | 'phone' | 'email';
  };
  contextData: {
    lastQuery: string;
    currentStep: string;
    conversation: Message[];
  };
}

export interface EscalationResponse {
  escalationId: string;
  estimatedWaitTime: number;
  lineUrl: string;
  ticketNumber: string;
  message: string;
}

// ===================
// Auth API Types (if needed)
// ===================

export interface VerifySessionRequest {
  sessionToken: string;
}

export interface VerifySessionResponse {
  valid: boolean;
  user?: UserInfo;
  session?: SessionInfo;
  expiresAt?: string;
}

// ===================
// Error Response Types
// ===================

export interface APIError {
  error: string;
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ValidationError extends APIError {
  code: 'VALIDATION_ERROR';
  details: {
    field: string;
    message: string;
    value?: any;
  }[];
}

// ===================
// Common API Types
// ===================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
