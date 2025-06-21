export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  language: 'en' | 'ja';
  isAuthenticated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: boolean;
  language: 'en' | 'ja';
}

export interface UserProfile extends User {
  preferences: UserPreferences;
}
