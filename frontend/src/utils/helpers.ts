import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export const formatDate = (date: Date, locale: string = 'ja'): string => {
  const localeMap = {
    ja: ja,
    en: undefined,
  };
  
  return format(date, 'PPp', { locale: localeMap[locale as keyof typeof localeMap] });
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const getLanguageFromStorage = (): string => {
  try {
    const stored = localStorage.getItem('mnp_user_preferences');
    if (stored) {
      const preferences = JSON.parse(stored);
      return preferences.language || 'ja';
    }
  } catch (error) {
    console.error('Error reading language from storage:', error);
  }
  return 'ja';
};

export const setLanguageToStorage = (language: string): void => {
  try {
    const stored = localStorage.getItem('mnp_user_preferences');
    const preferences = stored ? JSON.parse(stored) : {};
    preferences.language = language;
    localStorage.setItem('mnp_user_preferences', JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving language to storage:', error);
  }
};
