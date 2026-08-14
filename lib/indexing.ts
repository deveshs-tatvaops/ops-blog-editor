import crypto from 'node:crypto';

/**
 * Google Search Console Indexing API ping. Signs a service-account JWT directly
 * rather than pulling in googleapis for one call.
 * Set GSC_INDEXING_SERVICE_ACCOUNT to the service account JSON; unset = no-op.
 */
interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = base64url(
    crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(sa.private_key)
  );

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export interface IndexingResult {
  ok: boolean;
  skipped?: boolean;
  message: string;
}

export async function notifySearchConsole(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<IndexingResult> {
  const raw = process.env.GSC_INDEXING_SERVICE_ACCOUNT;
  if (!raw) return { ok: true, skipped: true, message: 'Search Console indexing not configured' };

  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    const token = await accessToken(sa);
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url, type }),
    });
    if (!res.ok) return { ok: false, message: `Indexing API ${res.status}: ${await res.text()}` };
    return { ok: true, message: `Submitted ${url} to the Indexing API` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Indexing request failed' };
  }
}
