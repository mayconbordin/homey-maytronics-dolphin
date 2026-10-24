'use strict';

import https from 'https';
import { AuthError } from './AuthError';
import {
  API_BASE_URL,
  API_HEADERS,
  COGNITO_CHALLENGE_NAME,
  COGNITO_CLIENT_ID,
  COGNITO_ENDPOINT,
  ID_TOKEN_REFRESH_WINDOW,
} from './constants';
import type {
  ApiResponse,
  AwsCredentials,
  CognitoAuthenticationResult,
  CognitoResponse,
  RobotDetails,
  UserProfile,
} from './types';

export { AuthError };

// Cognito error types that mean the user has to sign in again
const COGNITO_AUTH_ERRORS = [
  'NotAuthorizedException',
  'UserNotFoundException',
  'CodeMismatchException',
  'ExpiredCodeException',
];

interface HttpResponse {
  statusCode: number;
  body: string;
}

export class MaytronicsApi {

  private idToken: string = '';
  private idTokenExpiresAt: number = 0;
  private refreshToken: string = '';

  /**
   * Make an HTTPS request and return the raw status code and body.
   */
  private request(method: string, url: string, headers: Record<string, string>, body?: string): Promise<HttpResponse> {
    const bodyBuffer = body !== undefined ? Buffer.from(body, 'utf8') : undefined;
    const allHeaders = bodyBuffer
      ? { ...headers, 'Content-Length': String(bodyBuffer.length) }
      : headers;

    return new Promise((resolve, reject) => {
      const req = https.request(url, { method, headers: allHeaders }, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 0, body: data });
        });
      });
      req.on('error', reject);
      req.end(bodyBuffer);
    });
  }

  /**
   * Call an AWS Cognito Identity Provider action.
   */
  private async cognito(target: string, payload: Record<string, unknown>): Promise<CognitoResponse> {
    const res = await this.request('POST', COGNITO_ENDPOINT, {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    }, JSON.stringify(payload));

    let parsed: any;
    try {
      parsed = JSON.parse(res.body);
    } catch (err) {
      throw new Error(`Failed to parse Cognito ${target} response (HTTP ${res.statusCode}): ${res.body}`);
    }

    if (res.statusCode >= 400) {
      // __type looks like "NotAuthorizedException" or "prefix#NotAuthorizedException"
      const type = String(parsed.__type || '').split('#').pop() || '';
      const message = parsed.message || parsed.Message || type;
      if (COGNITO_AUTH_ERRORS.includes(type)) {
        throw new AuthError(message);
      }
      throw new Error(`Cognito ${target} failed (HTTP ${res.statusCode}): ${type} ${message}`);
    }

    return parsed as CognitoResponse;
  }

  private setTokens(result: CognitoAuthenticationResult): void {
    this.idToken = result.IdToken;
    this.idTokenExpiresAt = Date.now() + result.ExpiresIn * 1000;
    // REFRESH_TOKEN_AUTH does not return a new refresh token, keep the original
    if (result.RefreshToken) {
      this.refreshToken = result.RefreshToken;
    }
  }

  /**
   * Start the email OTP login. Maytronics emails a code to the user.
   * Returns the Cognito session needed to verify the code.
   */
  async startLogin(email: string): Promise<string> {
    const res = await this.cognito('InitiateAuth', {
      AuthFlow: 'CUSTOM_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: email },
      ClientMetadata: {},
    });
    if (res.ChallengeName !== COGNITO_CHALLENGE_NAME || !res.Session) {
      throw new Error(`Unexpected Cognito challenge: ${res.ChallengeName}`);
    }
    return res.Session;
  }

  /**
   * Verify the emailed code. On success the ID and refresh tokens are kept.
   * Throws an AuthError carrying a new session when the code was wrong but may be retried.
   */
  async verifyCode(email: string, session: string, code: string): Promise<void> {
    const res = await this.cognito('RespondToAuthChallenge', {
      ChallengeName: COGNITO_CHALLENGE_NAME,
      ClientId: COGNITO_CLIENT_ID,
      Session: session,
      ChallengeResponses: { USERNAME: email, ANSWER: code.trim() },
      ClientMetadata: {},
    });
    if (res.AuthenticationResult?.IdToken) {
      this.setTokens(res.AuthenticationResult);
      return;
    }
    // Cognito answers a wrong code with a new challenge
    throw new AuthError('The code is incorrect', res.Session);
  }

  /**
   * Make sure we have an ID token that is valid for a while, refreshing it if needed.
   */
  async ensureIdToken(): Promise<void> {
    if (this.idToken && this.idTokenExpiresAt - Date.now() > ID_TOKEN_REFRESH_WINDOW) {
      return;
    }
    if (!this.refreshToken) {
      throw new AuthError('Not signed in');
    }
    const res = await this.cognito('InitiateAuth', {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: this.refreshToken },
      ClientMetadata: {},
    });
    if (!res.AuthenticationResult?.IdToken) {
      throw new AuthError('Refresh token rejected');
    }
    this.setTokens(res.AuthenticationResult);
  }

  /**
   * Make an authenticated request to the Maytronics API.
   */
  private async apiRequest<T>(method: 'GET' | 'POST', path: string, body?: string): Promise<ApiResponse<T>> {
    await this.ensureIdToken();

    const headers: Record<string, string> = {
      ...API_HEADERS,
      Authorization: `Bearer ${this.idToken}`,
    };
    if (method === 'POST') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8';
    }

    const res = await this.request(method, `${API_BASE_URL}${path}`, headers, method === 'POST' ? body || '' : undefined);
    if (res.statusCode >= 400) {
      throw new Error(`API error on ${path}: HTTP ${res.statusCode}, body=${res.body}`);
    }

    let parsed: ApiResponse<T>;
    try {
      parsed = JSON.parse(res.body) as ApiResponse<T>;
    } catch (err) {
      throw new Error(`Failed to parse API response from ${path}: ${res.body}`);
    }
    if (parsed.Status !== '1' || !parsed.Data) {
      throw new Error(`API error on ${path}: status=${parsed.Status}, body=${res.body}`);
    }
    return parsed;
  }

  /**
   * Get the signed-in user's profile, including the robot serial number.
   */
  async getUserProfile(): Promise<UserProfile> {
    const res = await this.apiRequest<UserProfile>('POST', '/mobapi/user/authenticate-user/');
    return res.Data;
  }

  /**
   * Get robot details by robot serial number (name, family, motor unit serial).
   */
  async getRobotDetails(serialNumber: string): Promise<RobotDetails> {
    const res = await this.apiRequest<RobotDetails>(
      'POST',
      '/mobapi/serial-numbers/getRobotDetailsByRobotSN/',
      `SERNUM=${encodeURIComponent(serialNumber)}`,
    );
    return res.Data;
  }

  /**
   * Get temporary AWS IoT credentials for the robot.
   */
  async getAwsCredentials(serialNumber: string, deviceType: string): Promise<AwsCredentials> {
    const query = `sernum=${encodeURIComponent(serialNumber)}&device_type=${encodeURIComponent(deviceType)}`;
    const res = await this.apiRequest<AwsCredentials>('GET', `/mt-sso/aws/getToken/?${query}`);
    if (!res.Data.AccessKeyId) {
      throw new Error(`getToken returned no credentials: ${JSON.stringify(res.Alert)}`);
    }
    return res.Data;
  }

  /**
   * Get the Cognito refresh token (to persist across restarts).
   */
  getRefreshToken(): string {
    return this.refreshToken;
  }

  /**
   * Set the Cognito refresh token (for restoring from stored credentials).
   */
  setRefreshToken(refreshToken: string): void {
    this.refreshToken = refreshToken;
    this.idToken = '';
    this.idTokenExpiresAt = 0;
  }
}
