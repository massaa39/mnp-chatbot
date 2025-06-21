/**
 * フロントエンドAPI型定義
 * Purpose: バックエンドAPIとの通信型定義
 */

// ===================
// Base API Types
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

export interface APIError {
  error: string;
  code: string;
  message: string;
  details?: any;
  timestamp: string;
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
// History API Types
// ===================

export interface GetHistoryResponse {
  messages: Message[];
  session: SessionInfo;
  user: UserInfo;
  pagination: PaginationResponse;
}

export interface Message {
  id: string;
  sessionId: string;
  messageType: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, any>;
  embeddingVector?: number[];
  confidenceScore?: number;
  responseTimeMs?: number;
  createdAt: Date;
}

export interface PaginationResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ===================
// Escalation API Types
// ===================

export interface EscalationRequest {
  sessionToken: string;
  reason: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  contactInfo?: {
    email?: string;
    phone?: string;
    preferredContact?: 'email' | 'phone' | 'chat';
  };
  context?: Record<string, any>;
}

export interface EscalationResponse {
  ticketId: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'waiting_customer' | 'resolved' | 'cancelled';
  estimatedWaitTime: number;
  assignedAgent?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  queuePosition?: number;
  message: string;
}

// ===================
// FAQ API Types
// ===================

export interface FAQ {
  id: string;
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
  carrierSpecific?: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
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
// Client Configuration
// ===================

export interface APIClientConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  headers?: Record<string, string>;
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
}

// ===================
// Error Types
// ===================

export interface NetworkError extends Error {
  code: 'NETWORK_ERROR';
  status?: number;
  response?: any;
}

export interface ValidationError extends Error {
  code: 'VALIDATION_ERROR';
  details: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

export interface APIErrorResponse extends Error {
  code: string;
  status: number;
  response: APIResponse;
}

// ===================
// WebSocket Types
// ===================

export interface WebSocketMessage {
  type: 'escalation_update' | 'agent_assigned' | 'status_change' | 'chat_message';
  data: any;
  timestamp: string;
  sessionToken?: string;
  ticketId?: string;
}

export interface WebSocketTokenResponse {
  wsToken: string;
  wsUrl: string;
  expiresAt: string;
}

// ===================
// Additional API Types for Frontend
// ===================

export interface ChatHistoryRequest {
  sessionToken: string;
  page?: number;
  limit?: number;
}

export interface ChatHistoryResponse {
  messages: Message[];
  sessionInfo: SessionInfo;
  pagination: PaginationResponse;
}

export interface FAQSearchRequest {
  query: string;
  category?: string;
  carrier?: string;
  limit?: number;
}

export interface FAQSearchResponse {
  faqs: FAQ[];
  metadata: {
    total: number;
    searchTime: number;
    relevance: number;
  };
}

// ===================
// Admin Dashboard Types
// ===================

export interface EscalationStatsResponse {
  totalEscalations: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  averageWaitTime: number;
  averageResolutionTime: number;
  satisfactionRating: number;
  activeAgents: number;
  queueLength: number;
}

export interface EscalationListItem {
  id: string;
  ticketId: string;
  sessionToken: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'waiting_customer' | 'resolved' | 'cancelled';
  assignedAgent?: string;
  estimatedWaitTime: number;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationListResponse {
  escalations: EscalationListItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface EscalationUpdateRequest {
  status?: 'pending' | 'assigned' | 'in_progress' | 'waiting_customer' | 'resolved' | 'cancelled';
  assignedAgent?: string;
  notes?: string;
  estimatedWaitTime?: number;
}

export interface EscalationDetailsResponse {
  ticketId: string;
  sessionId: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'waiting_customer' | 'resolved' | 'cancelled';
  assignedAgent?: string;
  contactInfo: Record<string, any>;
  context: Record<string, any>;
  estimatedWaitTime: number;
  createdAt: string;
  updatedAt: string;
  customerInfo: {
    phoneNumber?: string;
  };
}

export interface FAQStatsResponse {
  totalFAQs: number;
  categoryStats: Array<{ category: string; count: number }>;
  carrierStats: Array<{ carrier: string; count: number }>;
  popularFAQs: Array<{ id: string; question: string; views: number }>;
}

export interface FAQCreateRequest {
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
  keywords?: string[];
  priority?: number;
  carrierSpecific?: string;
}

export interface FAQUpdateRequest {
  question?: string;
  answer?: string;
  keywords?: string[];
  priority?: number;
  isActive?: boolean;
}

export interface EscalationResolveRequest {
  resolution?: string;
  feedback?: string;
  rating?: number;
}
