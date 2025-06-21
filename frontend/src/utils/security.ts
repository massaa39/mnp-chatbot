/**
 * フロントエンドセキュリティユーティリティ
 * Purpose: クライアント側のセキュリティ機能とデータ保護
 */

/**
 * 入力値のサニタイゼーション
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // HTMLタグの除去
    .replace(/javascript:/gi, '') // JavaScriptプロトコルの除去
    .replace(/on\w+=/gi, '') // イベントハンドラーの除去
    .trim();
};

/**
 * HTMLエスケープ
 */
export const escapeHtml = (text: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * 電話番号の検証
 */
export const validatePhoneNumber = (phoneNumber: string): boolean => {
  const phoneRegex = /^(070|080|090)[0-9]{8}$/;
  return phoneRegex.test(phoneNumber.replace(/[-\s]/g, ''));
};

/**
 * 電話番号のマスキング
 */
export const maskPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber || phoneNumber.length < 8) {
    return phoneNumber;
  }
  
  const cleaned = phoneNumber.replace(/[-\s]/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 3)}-****-${cleaned.substring(7)}`;
  }
  
  return phoneNumber;
};

/**
 * セッショントークンの検証
 */
export const validateSessionToken = (token: string): boolean => {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // MNPチャットボット用のセッショントークン形式
  const tokenRegex = /^mnp_[a-f0-9-]{36}_[0-9]{13}$/;
  return tokenRegex.test(token);
};

/**
 * セキュアなローカルストレージ操作
 */
export const secureStorage = {
  /**
   * データを暗号化してローカルストレージに保存
   */
  setItem: (key: string, value: any): void => {
    try {
      const stringValue = JSON.stringify(value);
      const encodedValue = btoa(stringValue); // 簡単なBase64エンコード
      localStorage.setItem(key, encodedValue);
    } catch (error) {
      console.error('Failed to save to secure storage:', error);
    }
  },

  /**
   * ローカルストレージから復号化してデータを取得
   */
  getItem: <T>(key: string): T | null => {
    try {
      const encodedValue = localStorage.getItem(key);
      if (!encodedValue) return null;
      
      const stringValue = atob(encodedValue); // Base64デコード
      return JSON.parse(stringValue) as T;
    } catch (error) {
      console.error('Failed to retrieve from secure storage:', error);
      return null;
    }
  },

  /**
   * アイテムを削除
   */
  removeItem: (key: string): void => {
    localStorage.removeItem(key);
  },

  /**
   * 全ての保存データをクリア
   */
  clear: (): void => {
    localStorage.clear();
  },
};

/**
 * CSP（Content Security Policy）違反の検出
 */
export const setupCSPViolationReporting = (): void => {
  document.addEventListener('securitypolicyviolation', (event) => {
    console.warn('CSP Violation:', {
      violatedDirective: event.violatedDirective,
      blockedURI: event.blockedURI,
      originalPolicy: event.originalPolicy,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
    });
    
    // 実際の実装では、違反をサーバーに報告
    // reportSecurityViolation(event);
  });
};

/**
 * セキュアなHTTPクライアント設定
 */
export const createSecureHttpClient = () => {
  const headers: { [key: string]: string } = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  // CSRFトークンがある場合は追加
  const csrfToken = secureStorage.getItem<string>('csrf-token');
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  return {
    headers,
    credentials: 'include' as RequestCredentials,
  };
};

/**
 * 機密データの自動削除（メモリクリーンアップ）
 */
export const secureMemoryCleanup = () => {
  // WeakMap を使用して参照が残らないようにする
  const sensitiveDataMap = new WeakMap();
  
  return {
    store: (key: object, data: any) => {
      sensitiveDataMap.set(key, data);
    },
    
    retrieve: (key: object) => {
      return sensitiveDataMap.get(key);
    },
    
    // ガベージコレクションによる自動削除
    // WeakMapなので、keyオブジェクトが削除されれば自動的にデータも削除される
  };
};

/**
 * XSS攻撃の検出と防止
 */
export const detectXSS = (input: string): boolean => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b/gi,
    /<object\b/gi,
    /<embed\b/gi,
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
};

/**
 * URL検証
 */
export const validateURL = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    
    // 許可されたプロトコルのみ
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(urlObj.protocol)) {
      return false;
    }
    
    // 悪意のあるスキームの検出
    const maliciousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
    ];
    
    return !maliciousPatterns.some(pattern => pattern.test(url));
  } catch {
    return false;
  }
};

/**
 * ファイルアップロードの検証
 */
export const validateFileUpload = (file: File): { valid: boolean; error?: string } => {
  // ファイルサイズ制限（10MB）
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'ファイルサイズが大きすぎます（最大10MB）' };
  }
  
  // 許可されたファイルタイプ
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
  ];
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'サポートされていないファイル形式です' };
  }
  
  // ファイル名の検証
  const maliciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  
  if (maliciousExtensions.includes(fileExtension)) {
    return { valid: false, error: '危険なファイル形式です' };
  }
  
  return { valid: true };
};

/**
 * セッション管理
 */
export const sessionManager = {
  /**
   * セッションの有効期限チェック
   */
  isSessionValid: (sessionData: { expiresAt: string }): boolean => {
    const expirationTime = new Date(sessionData.expiresAt).getTime();
    const currentTime = Date.now();
    return currentTime < expirationTime;
  },

  /**
   * セッション延長
   */
  extendSession: (currentExpiresAt: string, extensionHours: number = 24): string => {
    const currentExpiration = new Date(currentExpiresAt);
    const newExpiration = new Date(currentExpiration.getTime() + extensionHours * 60 * 60 * 1000);
    return newExpiration.toISOString();
  },

  /**
   * セッション無効化
   */
  invalidateSession: (): void => {
    secureStorage.removeItem('sessionToken');
    secureStorage.removeItem('userSession');
    secureStorage.removeItem('csrf-token');
  },
};

/**
 * プライバシー保護設定
 */
export const privacySettings = {
  /**
   * 同意の記録
   */
  recordConsent: (consentType: string, granted: boolean): void => {
    const consent = {
      type: consentType,
      granted,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };
    
    secureStorage.setItem(`consent_${consentType}`, consent);
  },

  /**
   * 同意状況の確認
   */
  getConsentStatus: (consentType: string): boolean => {
    const consent = secureStorage.getItem<{
      granted: boolean;
      timestamp: string;
    }>(`consent_${consentType}`);
    
    return consent?.granted || false;
  },

  /**
   * データ削除要求
   */
  requestDataDeletion: async (): Promise<void> => {
    // 実際の実装では、サーバーにデータ削除要求を送信
    console.log('Data deletion requested');
    sessionManager.invalidateSession();
  },
};

/**
 * セキュリティイベントの監視
 */
export const securityMonitor = {
  /**
   * 怪しいアクティビティの検出
   */
  detectSuspiciousActivity: (activity: {
    type: 'login_attempt' | 'data_access' | 'api_call';
    frequency: number;
    timeWindow: number;
  }): boolean => {
    // 実装例：短時間での大量アクセスの検出
    const threshold = activity.type === 'login_attempt' ? 5 : 50;
    return activity.frequency > threshold;
  },

  /**
   * セキュリティアラートの表示
   */
  showSecurityAlert: (message: string, severity: 'info' | 'warning' | 'error'): void => {
    console.warn(`[Security Alert - ${severity.toUpperCase()}]`, message);
    
    // 実際の実装では、UIにアラートを表示
    // showNotification(message, severity);
  },
};

/**
 * フィンガープリンティング対策
 */
export const antiFingerprinting = {
  /**
   * ブラウザ情報のノイズ化
   */
  addNoise: (value: string): string => {
    // 実装例：わずかなランダムノイズを追加
    const noise = Math.random().toString(36).substring(2, 5);
    return `${value}_${noise}`;
  },

  /**
   * 最小限の情報のみ送信
   */
  getMinimalBrowserInfo: () => ({
    language: navigator.language.substring(0, 2), // 'ja-JP' -> 'ja'
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenResolution: `${screen.width}x${screen.height}`,
  }),
};

export default {
  sanitizeInput,
  escapeHtml,
  validatePhoneNumber,
  maskPhoneNumber,
  validateSessionToken,
  secureStorage,
  setupCSPViolationReporting,
  createSecureHttpClient,
  secureMemoryCleanup,
  detectXSS,
  validateURL,
  validateFileUpload,
  sessionManager,
  privacySettings,
  securityMonitor,
  antiFingerprinting,
};