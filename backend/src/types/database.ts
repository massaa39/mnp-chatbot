/**
 * データベース型定義
 * Purpose: PostgreSQLテーブル構造の型定義
 */

export interface User {
  id: string;
  sessionId: string;
  phoneNumber?: string;
  currentCarrier?: string;
  targetCarrier?: string;
  status: 'active' | 'completed' | 'escalated';
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSession {
  id: string;
  userId: string;
  sessionToken: string;
  mode: 'roadmap' | 'step_by_step';
  currentStep: string;
  scenarioData: Record<string, any>;
  contextData: Record<string, any>;
  escalationReason?: string;
  escalatedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
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

export interface FAQ {
  id: string;
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
  keywords: string[];
  embeddingVector?: number[];
  priority: number;
  carrierSpecific?: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseConnection {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>;
  end: () => Promise<void>;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  oid: number;
  fields: Array<{
    name: string;
    tableID: number;
    columnID: number;
    dataTypeID: number;
    dataTypeSize: number;
    dataTypeModifier: number;
    format: string;
  }>;
}
