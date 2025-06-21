/**
 * チャット関連型定義
 * Purpose: チャット機能のUI状態とロジック型定義
 */

import { ChatAction, SessionInfo, UserInfo } from './api';

// ===================
// Chat State Types
// ===================

export interface ChatState {
  // セッション情報
  messages: Message[];
  currentSession: SessionInfo | null;
  mode: ChatMode;
  uiState: UIState;
  escalationState: EscalationState;
  preferences: ChatPreferences;
}

export type ChatMode = 'roadmap' | 'step_by_step';

export type MessageType = 'user' | 'ai' | 'system';

export interface UIState {
  isLoading: boolean;
  isTyping: boolean;
  error: string | null;
  isConnected: boolean;
  showQuickReplies: boolean;
  scrollToBottom: boolean;
}

export interface EscalationState {
  isEscalated: boolean;
  reason: string | null;
  timestamp: string | null;
  ticketId: string | null;
  estimatedWaitTime: number | null;
  status: 'none' | 'pending' | 'connected' | 'resolved';
}

export interface ChatPreferences {
  notifications: boolean;
  sound: boolean;
  theme: 'light' | 'dark';
  language: 'ja' | 'en';
}

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: string;
  metadata?: any;
}

export interface ChatMessage extends Message {
  // UI固有のプロパティ
  isAnimating?: boolean;
  isOptimistic?: boolean; // 送信中のメッセージかどうか
  failedToSend?: boolean;
  
  // 表示用の拡張データ
  displayContent?: string;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
}

export interface MessageAttachment {
  type: 'image' | 'file' | 'link' | 'roadmap';
  url?: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  size?: number;
  data?: any; // roadmapの場合はシナリオデータ
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface EscalationInfo {
  reason: string;
  lineUrl: string;
  estimatedWaitTime?: number;
  ticketNumber?: string;
  isActive: boolean;
  contextData: {
    lastQuery: string;
    currentStep: string;
    conversation: Message[];
  };
}

// ===================
// Roadmap Types
// ===================

export interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  type: 'information' | 'action' | 'confirmation' | 'troubleshooting';
  estimatedTime?: number; // 分単位
  requirements: string[];
  nextSteps: string[];
  
  // キャリア固有情報
  carrierSpecific?: {
    [carrier: string]: {
      title?: string;
      description?: string;
      requirements?: string[];
      warnings?: string[];
      additionalSteps?: RoadmapStep[];
    };
  };
  
  // UI表示用
  icon?: string;
  color?: string;
  isOptional?: boolean;
  troubleshooting?: TroubleshootingInfo[];
}

export interface TroubleshootingInfo {
  problem: string;
  solution: string;
  relatedFAQs: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface RoadmapData {
  steps: RoadmapStep[];
  currentStepIndex: number;
  progress: number; // 0-100
  estimatedTotalTime: number;
  completedSteps: string[];
  skippedSteps: string[];
  
  // キャリア固有のロードマップ調整
  carrierAdjustments?: {
    [carrier: string]: {
      additionalSteps?: RoadmapStep[];
      modifiedSteps?: Partial<RoadmapStep>[];
      hiddenSteps?: string[];
    };
  };
}

// ===================
// Quick Reply Types
// ===================

export interface QuickReplyOption {
  id: string;
  title: string;
  description?: string;
  payload: {
    type: string;
    query?: string;
    category?: string;
    carrier?: string;
    priority?: string;
    [key: string]: any;
  };
  disabled?: boolean;
  icon?: string;
  style?: 'default' | 'primary' | 'secondary' | 'outline';
}

export interface QuickReply {
  id: string;
  text: string;
  value: string;
  type: 'text' | 'action' | 'navigation';
  style?: 'default' | 'primary' | 'secondary' | 'outline';
  icon?: string;
  disabled?: boolean;
}

export interface QuickReplyGroup {
  id: string;
  title?: string;
  replies: QuickReply[];
  displayType: 'horizontal' | 'vertical' | 'grid';
  maxVisible?: number;
}

// ===================
// Input Types
// ===================

export interface ChatInputState {
  value: string;
  placeholder: string;
  disabled: boolean;
  maxLength: number;
  showCharCount: boolean;
  suggestions: InputSuggestion[];
  attachmentTypes: AttachmentType[];
}

export interface InputSuggestion {
  id: string;
  text: string;
  description?: string;
  category?: string;
  frequency?: number; // 使用頻度
}

export interface AttachmentType {
  type: 'image' | 'file' | 'camera' | 'location';
  label: string;
  icon: string;
  maxSize?: number;
  allowedFormats?: string[];
  enabled: boolean;
}

// ===================
// Animation Types
// ===================

export interface ChatAnimationConfig {
  messageAppear: {
    duration: number;
    easing: string;
    stagger: number;
  };
  typing: {
    dotCount: number;
    animationDuration: number;
  };
  scroll: {
    duration: number;
    easing: string;
  };
  quickReply: {
    slideIn: {
      duration: number;
      easing: string;
    };
  };
}

// ===================
// Notification Types
// ===================

export interface ChatNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  actions?: NotificationAction[];
  duration?: number; // auto-close時間（ms）
  persistent?: boolean;
  timestamp: Date;
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'default' | 'primary' | 'danger';
}

// ===================
// Theme Types
// ===================

export interface ChatTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    userMessage: string;
    assistantMessage: string;
    text: string;
    textSecondary: string;
    border: string;
    shadow: string;
    accent: string;
    error: string;
    warning: string;
    success: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      small: string;
      medium: string;
      large: string;
    };
    lineHeight: {
      small: number;
      medium: number;
      large: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    small: string;
    medium: string;
    large: string;
  };
  shadows: {
    small: string;
    medium: string;
    large: string;
  };
}

// ===================
// Accessibility Types
// ===================

export interface AccessibilityConfig {
  announceMessages: boolean;
  keyboardNavigation: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  screenReader: {
    messageFormat: string;
    actionFormat: string;
    statusFormat: string;
  };
}
