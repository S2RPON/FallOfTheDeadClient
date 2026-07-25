export class BackendClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async register(data) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async login(data) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async verifyEmail(token) {
    return this.request('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  async resendVerification(email) {
    return this.request('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async refresh(refreshToken) {
    return this.request('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  }

  async logout(refreshToken) {
    return this.request('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  }

  async searchUsers(query, token) {
    const url = new URL(`${this.baseUrl}/api/users/search`);
    url.searchParams.set('q', query);
    return this.request(url.pathname + url.search, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async getSuggestions(token) {
    return this.request('/api/users/suggestions', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async sendFriendRequest(addresseeId, token) {
    return this.request('/api/friends/request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ addresseeId })
    });
  }

  async acceptFriend(userId, token) {
    return this.request('/api/friends/accept', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
  }

  async declineFriend(userId, token) {
    return this.request('/api/friends/decline', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
  }

  async cancelRequest(userId, token) {
    return this.request('/api/friends/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
  }

  async removeFriend(friendId, token) {
    return this.request('/api/friends/remove', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ friendId })
    });
  }

  async blockUser(userId, token) {
    return this.request('/api/friends/block', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
  }

  async unblockUser(userId, token) {
    return this.request('/api/friends/unblock', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId })
    });
  }

  async getFriends(token) {
    return this.request('/api/friends/list', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async getFriendRequests(token) {
    return this.request('/api/friends/requests', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async getSentRequests(token) {
    return this.request('/api/friends/requests/sent', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async getBlocks(token) {
    return this.request('/api/friends/blocks', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async request(path, init = {}) {
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

let client = null;
export function getBackendClient() {
  if (!client) {
    const baseUrl = (typeof process !== 'undefined' && process.env?.VITE_API_URL) || 'http://localhost:3000';
    client = new BackendClient(baseUrl);
  }
  return client;
}
