
import { create } from 'zustand';

interface ConnectionState {
  isOnline: boolean;
  isSocketConnected: boolean;
  setOnline: (status: boolean) => void;
  setSocketConnected: (status: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSocketConnected: true,
  setOnline: (status) => set({ isOnline: status }),
  setSocketConnected: (status) => set({ isSocketConnected: status }),
}));
