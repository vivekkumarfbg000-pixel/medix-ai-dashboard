import React, { useContext } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, AuthContext } from '../auth/AuthProvider';

// ─── High-Fidelity LocalStorage Mock with Keys Visibility ─────────────────────
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value.toString();
    (mockLocalStorage as any)[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete store[key];
    delete (mockLocalStorage as any)[key];
  },
  clear: () => {
    Object.keys(store).forEach(key => {
      delete store[key];
      delete (mockLocalStorage as any)[key];
    });
  },
  key: (index: number) => Object.keys(store)[index] || null,
  get length() { return Object.keys(store).length; }
};

// Re-bind global localStorage dynamically for this suite
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  configurable: true
});

// ─── Supabase Mocking Engine ────────────────────────────────────────────────
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
const mockUnsubscribe = vi.fn();
const mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: mockUnsubscribe } }
});
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: any) => {
        // Instantly trigger initial check callback
        setTimeout(() => cb("INITIAL_CHECK", null), 0);
        return mockOnAuthStateChange();
      },
      signInWithPassword: (credentials: any) => mockSignInWithPassword(credentials),
      signOut: () => mockSignOut()
    }
  }
}));

// ─── Test Consumer Widget ────────────────────────────────────────────────────
const TestConsumer = () => {
  const auth = useContext(AuthContext);
  if (!auth) return <div data-testid="no-context">No Auth Context</div>;
  return (
    <div>
      <div data-testid="loading-state">{auth.loading ? "LOADING" : "READY"}</div>
      <div data-testid="user-state">{auth.user ? auth.user.email : "ANONYMOUS"}</div>
      <button data-testid="logout-trigger" onClick={auth.signOut}>Log Out</button>
    </div>
  );
};

describe('AuthProvider: Sticky Session & Anti-Flash Redirects Integration Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('should initialize immediately in LOADING=false state when no Supabase token is stored in localStorage (Zero-Flash logged-out path)', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading-state').textContent).toBe('READY');
    expect(screen.getByTestId('user-state').textContent).toBe('ANONYMOUS');
  });

  it('should read the cached Supabase user session synchronously from localStorage before mounting (Zero-Flash logged-in path)', async () => {
    const mockTokenKey = 'sb-ykrqpxbbyfipjqhpaszf-auth-token';
    const mockSessionPayload = {
      user: { id: 'usr-123', email: 'admin@medix.ai' },
      access_token: 'secret-token-123'
    };
    mockLocalStorage.setItem(mockTokenKey, JSON.stringify(mockSessionPayload));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading-state').textContent).toBe('READY');
    expect(screen.getByTestId('user-state').textContent).toBe('admin@medix.ai');
  });

  it('should purge session tokens and optimistic cache stores upon signing out', async () => {
    mockLocalStorage.setItem('currentShopId', 'shop-premium-101');
    mockLocalStorage.setItem('medix_cached_shops', '[]');
    
    const mockTokenKey = 'sb-ykrqpxbbyfipjqhpaszf-auth-token';
    const mockSessionPayload = {
      user: { id: 'usr-123', email: 'admin@medix.ai' },
      access_token: 'secret-token-123'
    };
    mockLocalStorage.setItem(mockTokenKey, JSON.stringify(mockSessionPayload));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('user-state').textContent).toBe('admin@medix.ai');

    const logoutBtn = screen.getByTestId('logout-trigger');
    await act(async () => {
      logoutBtn.click();
    });

    expect(mockLocalStorage.getItem('currentShopId')).toBeNull();
    expect(mockLocalStorage.getItem('medix_cached_shops')).toBeNull();
    expect(screen.getByTestId('user-state').textContent).toBe('ANONYMOUS');
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
