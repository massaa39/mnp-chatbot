/**
 * フロントエンド型定義
 * Purpose: React アプリケーション全体で使用する型定義
 */

// メッセージ型
export interface Message {
  id: string;
  sessionId: string;
  messageType: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

// チャットセッション型
export interface ChatSession {
  id: string;
  userId: string;
  sessionToken: string;
  mode: 'roadmap' | 'step_by_step';
  currentStep: string;
  scenarioData: Record<string, any>;
  contextData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// チャット応答型
export interface ChatResponse {
  message: string;
  suggestions?: string[];
  actions?: ChatAction[];
  roadmap?: RoadmapStep[];
  escalation?: EscalationInfo;
}

// チャットアクション型
export interface ChatAction {
  type: 'button' | 'link' | 'escalation';
  label: string;
  value: string;
  url?: string;
}

// ロードマップステップ型
export interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  estimatedTime?: string;
  requirements?: string[];
}

// エスカレーション情報型
export interface EscalationInfo {
  reason: string;
  lineUrl: string;
  contextData: Record<string, any>;
}

// API応答型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

// チャットストア状態型
export interface ChatState {
  messages: Message[];
  currentSession: ChatSession | null;
  isLoading: boolean;
  error: string | null;
}

// ユーザー設定型
export interface UserPreferences {
  language: string;
  theme: 'light' | 'dark';
  notifications: boolean;
  carrierInfo?: {
    current?: string;
    target?: string;
  };
}

// UI状態型
export interface UIState {
  sidebarOpen: boolean;
  currentScreen: 'chat' | 'roadmap' | 'settings';
  showQuickReplies: boolean;
  typingIndicator: boolean;
}