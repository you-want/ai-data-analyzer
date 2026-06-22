'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  apiFetch,
  type AuthSession,
  type FrontendAuthUser,
  type WorkspaceSummary,
} from '@/lib/backend';

const STORAGE_KEY = 'ai-data-analyzer.auth-session';

interface AuthContextValue {
  ready: boolean;
  isAuthenticated: boolean;
  user: FrontendAuthUser | null;
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  activeWorkspaceId: string | null;
  accessToken: string | null;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: {
    email: string;
    name: string;
    password: string;
  }) => Promise<void>;
  completeAuthSession: (payload: {
    accessToken: string;
    user: FrontendAuthUser;
    defaultWorkspaceId?: string;
  }) => Promise<void>;
  refreshWorkspaces: (preferredWorkspaceId?: string) => Promise<void>;
  logout: () => void;
  switchWorkspace: (workspaceId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<FrontendAuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setReady(true);
      return;
    }

    try {
      const session = JSON.parse(raw) as AuthSession;
      setAccessToken(session.accessToken);
      setUser(session.user);
      setWorkspaces(session.workspaces);
      setActiveWorkspaceId(
        session.defaultWorkspaceId || session.workspaces[0]?.workspaceId || null,
      );
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  const persistSession = useCallback((session: AuthSession) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAccessToken(session.accessToken);
    setUser(session.user);
    setWorkspaces(session.workspaces);
    setActiveWorkspaceId(
      session.defaultWorkspaceId || session.workspaces[0]?.workspaceId || null,
    );
  }, []);

  const hydrateSession = useCallback(
    async (payload: {
      accessToken: string;
      user: FrontendAuthUser;
      defaultWorkspaceId?: string;
    }) => {
      const workspaceList = await apiFetch<WorkspaceSummary[]>('/auth/workspaces', {
        accessToken: payload.accessToken,
      });

      persistSession({
        accessToken: payload.accessToken,
        user: payload.user,
        defaultWorkspaceId: payload.defaultWorkspaceId,
        workspaces: workspaceList,
      });
    },
    [persistSession],
  );

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const payload = await apiFetch<{
        accessToken: string;
        user: FrontendAuthUser;
        defaultWorkspaceId?: string;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });

      await hydrateSession(payload);
    },
    [hydrateSession],
  );

  const register = useCallback(
    async (input: { email: string; name: string; password: string }) => {
      const payload = await apiFetch<{
        accessToken: string;
        user: FrontendAuthUser;
        defaultWorkspaceId?: string;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });

      await hydrateSession(payload);
    },
    [hydrateSession],
  );

  const completeAuthSession = useCallback(
    async (payload: {
      accessToken: string;
      user: FrontendAuthUser;
      defaultWorkspaceId?: string;
    }) => {
      await hydrateSession(payload);
    },
    [hydrateSession],
  );

  const refreshWorkspaces = useCallback(
    async (preferredWorkspaceId?: string) => {
      if (!accessToken || !user) {
        return;
      }

      const workspaceList = await apiFetch<WorkspaceSummary[]>('/auth/workspaces', {
        accessToken,
      });
      persistSession({
        accessToken,
        user,
        defaultWorkspaceId:
          preferredWorkspaceId ||
          activeWorkspaceId ||
          workspaceList[0]?.workspaceId ||
          undefined,
        workspaces: workspaceList,
      });
    },
    [accessToken, user, persistSession, activeWorkspaceId],
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAccessToken(null);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
  }, []);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    const nextSession: AuthSession | null =
      accessToken && user
        ? {
            accessToken,
            user,
            defaultWorkspaceId: workspaceId,
            workspaces,
          }
        : null;
    if (nextSession) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    }
  }, [accessToken, user, workspaces]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      isAuthenticated: Boolean(accessToken && user),
      user,
      workspaces,
      activeWorkspace:
        workspaces.find((workspace) => workspace.workspaceId === activeWorkspaceId) ||
        null,
      activeWorkspaceId,
      accessToken,
      login,
      register,
      completeAuthSession,
      refreshWorkspaces,
      logout,
      switchWorkspace,
    }),
    [
      ready,
      accessToken,
      user,
      workspaces,
      activeWorkspaceId,
      login,
      register,
      completeAuthSession,
      refreshWorkspaces,
      logout,
      switchWorkspace,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return value;
}
