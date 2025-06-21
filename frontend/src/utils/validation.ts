export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!email) {
    errors.push('メールアドレスを入力してください');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('有効なメールアドレスを入力してください');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validatePhoneNumber = (phone: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!phone) {
    errors.push('電話番号を入力してください');
  } else if (!/^[0-9\-]+$/.test(phone)) {
    errors.push('有効な電話番号を入力してください');
  } else if (phone.replace(/\-/g, '').length < 10) {
    errors.push('電話番号は10桁以上で入力してください');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateMessage = (message: string, maxLength: number = 2000): ValidationResult => {
  const errors: string[] = [];
  
  if (!message || !message.trim()) {
    errors.push('メッセージを入力してください');
  } else if (message.length > maxLength) {
    errors.push(`メッセージは${maxLength}文字以内で入力してください`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateRequired = (value: string, fieldName: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!value || !value.trim()) {
    errors.push(`${fieldName}を入力してください`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateSessionToken = (token: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!token) {
    errors.push('セッショントークンが必要です');
  } else if (token.length < 10) {
    errors.push('無効なセッショントークンです');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove potentially dangerous characters
    .trim();
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};