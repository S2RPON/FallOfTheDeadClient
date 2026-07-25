export class BackendClient {
  constructor(private baseUrl: string) {}

  async register(data: { username: string; displayName: string; email: string; password: string }) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async login(data: { emailOrUsername: string; password: string }) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async verifyEmail(token: string) {
    return this.request('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  async resendVerification(email: string) {
    return this.request('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async refresh(refreshToken: string) {
    return this.request('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  }

  async logout(refreshToken?: string) {
    return this.request('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  }

  async searchUsers(query: string, token: string) {
    const url = new URL(`${this.baseUrl}/api/users/search`);
    url.searchParams.set('q', query);
    return this.request(url.pathname + url.search, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async getSuggestions(token: string) {
    return this.request('/api/users/suggestions', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async sendFriendRequest(addresseeId: string, token: string) {
    return this.request('/api/friends/request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ addresseeId })
    });
  }

  async acceptFriend(requesterId: string, token: string) {
    return this.request('/api/friends/accept', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: requesterId })
    });
  }

  async declineFriend(requesterId: string, token: string) {
    return this.request('/api/friends/decline', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: requesterId })
    });
  }

  async cancelRequest(addresseeId: string, token: string) {
    return this.request('/api/friends/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: addresseeId })
    });
  }

  async removeFriend(friendshipId: string, token: string) {
    return this.request('/api/friends/remove', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ friendId: friendshipId })
    });
  }

  async blockUser(userId: string, token: string) {
    return this.request('/api/friends/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
  }

  async unblockUser(userId: string, token: string) {
    return this.request('/api/friends/unblock', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
  }

  async getFriends(token: string) {
    return this.request('/api/friends/list', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async getFriendRequests(token: string) {
    return this.request('/api/friends/requests', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async getSentRequests(token: string) {
    return this.request('/api/friends/requests/sent', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async getBlocks(token: string) {
    return this.request('/api/friends/blocks', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  private async request(path: string, init: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {})
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }
    return data;
  }
}

let client: BackendClient | null = null;
export function getBackendClient() {
  if (!client) {
    const baseUrl = (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:3000';
    client = new BackendClient(baseUrl);
  }
  return client;
}
