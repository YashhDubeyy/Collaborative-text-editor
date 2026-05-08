import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  username: string;
  email: string;
  color: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  revision: number;
  isPublic: boolean;
  ownerId: string;
  owner: { username: string; color: string };
  createdAt: string;
  updatedAt: string;
  _count?: { shares: number };
}

export interface RemoteUser {
  socketId: string;
  username: string;
  color: string;
  cursor?: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

interface EditorState {
  documents: Document[];
  currentDoc: Document | null;
  remoteUsers: RemoteUser[];
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  setDocuments: (docs: Document[]) => void;
  setCurrentDoc: (doc: Document | null) => void;
  updateDocTitle: (id: string, title: string) => void;
  setRemoteUsers: (users: RemoteUser[]) => void;
  updateRemoteCursor: (socketId: string, cursor: number) => void;
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'collab-auth' }
  )
);

export const useEditorStore = create<EditorState>((set) => ({
  documents: [],
  currentDoc: null,
  remoteUsers: [],
  connectionStatus: 'disconnected',
  setDocuments: (documents) => set({ documents }),
  setCurrentDoc: (currentDoc) => set({ currentDoc }),
  updateDocTitle: (id, title) =>
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, title } : d)),
      currentDoc: s.currentDoc?.id === id ? { ...s.currentDoc, title } : s.currentDoc,
    })),
  setRemoteUsers: (remoteUsers) => set({ remoteUsers }),
  updateRemoteCursor: (socketId, cursor) =>
    set((s) => ({
      remoteUsers: s.remoteUsers.map((u) =>
        u.socketId === socketId ? { ...u, cursor } : u
      ),
    })),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
