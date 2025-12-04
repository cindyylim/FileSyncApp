import { create } from 'zustand';
import { authAPI } from '../services/api';

const useAuthStore = create((set, get) => ({
    user: null,
    loading: true,
    setUser: (user) => set({ user }),
    logout: () => set({ user: null }),
    checkAuth: async () => {
        try {
            set({ loading: true });
            const response = await authAPI.getMe();
            set({ user: response.data.user });
        } catch (error) {
            set({ user: null });
        } finally {
            set({ loading: false });
        }
    },
    isAuthenticated: () => !!get().user,
}));

export default useAuthStore;
