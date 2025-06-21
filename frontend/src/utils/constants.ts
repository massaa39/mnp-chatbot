export const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.mnp-chatbot.com' 
  : 'http://localhost:3000';

export const API_ENDPOINTS = {
  AUTH: {
    CREATE_SESSION: '/api/auth/session',
    VERIFY_SESSION: '/api/auth/verify',
    REFRESH_SESSION: '/api/auth/refresh',
  },
  CHAT: {
    SEND_MESSAGE: '/api/chat/message',
    GET_HISTORY: '/api/chat/history',
    START_SESSION: '/api/chat/session',
  },
  ESCALATION: {
    INITIATE: '/api/escalation/initiate',
    STATUS: '/api/escalation/status',
    UPDATE: '/api/escalation/update',
  },
  FAQ: {
    GET_ALL: '/api/faq',
    CREATE: '/api/faq',
    UPDATE: '/api/faq',
    DELETE: '/api/faq',
    STATS: '/api/faq/stats',
  },
} as const;

export const WEBSOCKET_URL = process.env.NODE_ENV === 'production'
  ? 'wss://api.mnp-chatbot.com'
  : 'ws://localhost:3000';

export const STORAGE_KEYS = {
  SESSION_TOKEN: 'mnp_session_token',
  USER_PREFERENCES: 'mnp_user_preferences',
  CHAT_HISTORY: 'mnp_chat_history',
  THEME: 'mnp_theme',
  LANGUAGE: 'mnp_language',
} as const;

export const CHAT_MODES = {
  STEP_BY_STEP: 'step_by_step',
  ROADMAP: 'roadmap',
} as const;

export const MESSAGE_TYPES = {
  USER: 'user',
  AI: 'ai',
  SYSTEM: 'system',
} as const;

export const ESCALATION_STATUS = {
  NONE: 'none',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
} as const;

export const UI_CONSTANTS = {
  MAX_MESSAGE_LENGTH: 2000,
  TYPING_DELAY: 1000,
  AUTO_SCROLL_DELAY: 100,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const;

export const LANGUAGES = {
  JAPANESE: 'ja',
  ENGLISH: 'en',
} as const;

export const QUICK_REPLIES = {
  GETTING_STARTED: [
    { text: 'MNPについて教えて', action: 'ask_about_mnp' },
    { text: '手続きの流れを知りたい', action: 'show_process' },
    { text: '必要な書類は？', action: 'show_documents' },
    { text: 'よくある質問', action: 'show_faq' },
  ],
  TROUBLESHOOTING: [
    { text: '手続きが進まない', action: 'escalate_stuck' },
    { text: 'エラーが発生している', action: 'escalate_error' },
    { text: '人に相談したい', action: 'request_human' },
    { text: '最初からやり直す', action: 'restart_session' },
  ],
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'ネットワークエラーが発生しました。接続を確認してください。',
  SESSION_EXPIRED: 'セッションが期限切れです。ページを更新してください。',
  MESSAGE_TOO_LONG: `メッセージは${UI_CONSTANTS.MAX_MESSAGE_LENGTH}文字以内で入力してください。`,
  UNKNOWN_ERROR: '予期しないエラーが発生しました。しばらく後でお試しください。',
  ESCALATION_FAILED: 'エスカレーションの開始に失敗しました。',
  SEND_MESSAGE_FAILED: 'メッセージの送信に失敗しました。',
} as const;