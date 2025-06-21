import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, UserPreferences } from '../types/user';

export interface UserState {
  user: User | null;
  preferences: UserPreferences;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearUser: () => void;
}

const defaultPreferences: UserPreferences = {
  theme: 'light',
  notifications: true,
  language: 'ja',
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      preferences: defaultPreferences,
      isLoading: false,
      error: null,
      
      setUser: (user) => set({ user, error: null }),
      
      updatePreferences: (newPreferences) => 
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences },
        })),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error, isLoading: false }),
      
      clearUser: () => set({ 
        user: null, 
        preferences: defaultPreferences,
        error: null,
        isLoading: false,
      }),
    }),
    {
      name: 'mnp-user-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        preferences: state.preferences,
      }),
    }
  )
);
