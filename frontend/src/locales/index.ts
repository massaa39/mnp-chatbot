import jaMessages from './ja.json';

export type LocaleKey = 'ja' | 'en';

export interface MessageKeys {
  [key: string]: string;
}

const messages: Record<LocaleKey, MessageKeys> = {
  ja: jaMessages,
  en: {
    // English translations would go here
    'chat.welcome': 'Welcome to MNP Support',
    'chat.placeholder': 'Type your message...',
    'chat.send': 'Send',
    'escalation.button': 'Request Human Support',
    'escalation.reason': 'Please describe your issue',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
  },
};

export const getMessage = (key: string, locale: LocaleKey = 'ja'): string => {
  return messages[locale]?.[key] || key;
};

export const getMessages = (locale: LocaleKey = 'ja'): MessageKeys => {
  return messages[locale] || messages.ja;
};

export default messages;