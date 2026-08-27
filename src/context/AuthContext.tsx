import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setUnauthorizedHandler } from '../api/client';
import { authApi, type UserRole } from '../api/endpoints';
import { effectivePermissions, type PermissionKey } from '../utils/permissions';
import { resolveEntitlements, type Entitlements } from '../utils/entitlements';

export interface UserDetail {
  _id: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  [key: string]: any;
}

interface AuthContextValue {
  token: string | null;
  userDetail: UserDetail | null;
  isLoading: boolean;
  permissions: PermissionKey[];
  can: (permission: PermissionKey) => boolean;
  /** What the provider's plan covers. Staff come back `open` - see resolveEntitlements. */
  entitlements: Entitlements;
  agencyId: string | undefined;
  login: (token: string, userDetail: UserDetail) => Promise<void>;
  logout: () => Promise<void>;
  updateUserDetail: (userDetail: UserDetail) => Promise<void>;
  /** Re-reads the account from the API - picks up a permission the provider changed. */
  refreshProfile: () => Promise<void>;
}

function readId(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value._id ?? value.id ?? undefined;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    await AsyncStorage.removeMany(['token', 'userDetail']);
    setToken(null);
    setUserDetail(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUserDetail(null);
    });
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getMany(['token', 'userDetail']);
      const storedToken = stored.token;
      const storedUserDetail = stored.userDetail;
      if (storedToken) setToken(storedToken);
      if (storedUserDetail) {
        try {
          setUserDetail(JSON.parse(storedUserDetail));
        } catch {
          await AsyncStorage.removeItem('userDetail');
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (newToken: string, newUserDetail: UserDetail) => {
    await AsyncStorage.setMany({
      token: newToken,
      userDetail: JSON.stringify(newUserDetail),
    });
    setToken(newToken);
    setUserDetail(newUserDetail);
  }, []);

  const updateUserDetail = useCallback(async (newUserDetail: UserDetail) => {
    await AsyncStorage.setItem('userDetail', JSON.stringify(newUserDetail));
    setUserDetail(newUserDetail);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const res: any = await authApi.getProfile();
      const profile = res?.data;
      if (!profile) return;
      setUserDetail(prev => {
        const merged = { ...(prev ?? {}), ...profile, id: profile._id ?? prev?.id } as UserDetail;
        AsyncStorage.setItem('userDetail', JSON.stringify(merged));
        return merged;
      });
    } catch {
      // Offline or a stale token: keep the cached account and carry on. A 401
      // is already handled by the client's unauthorized handler above.
    }
  }, []);

  useEffect(() => {
    if (token) refreshProfile();
  }, [token, refreshProfile]);

  const permissions = useMemo(() => effectivePermissions(userDetail), [userDetail]);

  const can = useCallback(
    (permission: PermissionKey) => permissions.includes(permission),
    [permissions],
  );

  const entitlements = useMemo(() => resolveEntitlements(userDetail), [userDetail]);

  const agencyId = useMemo(() => {
    if (!userDetail) return undefined;
    if (userDetail.role === 'staff') return readId(userDetail.parent_provider);
    return userDetail.id ?? userDetail._id;
  }, [userDetail]);

  const value = useMemo(
    () => ({
      token,
      userDetail,
      isLoading,
      permissions,
      can,
      entitlements,
      agencyId,
      login,
      logout,
      updateUserDetail,
      refreshProfile,
    }),
    [
      token,
      userDetail,
      isLoading,
      permissions,
      can,
      entitlements,
      agencyId,
      login,
      logout,
      updateUserDetail,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
