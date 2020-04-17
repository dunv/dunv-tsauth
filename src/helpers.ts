import axios, { AxiosInstance } from 'axios';
import { AuthStore } from './authStore';
import jwtDecode from 'jwt-decode';
import { RefreshToken } from './models';

export const UAUTH_ERROR_INVALID_REFRESH_TOKEN = 'ErrInvalidRefreshToken';
export const UAUTH_ERROR_INVALID_USER = 'ErrInvalidUser';

const helper = () => {
    const authStore = AuthStore.get();
    if (!authStore.url) {
        throw new Error('URL needs to be configured before usage');
    }

    return { url: authStore.url, authStore };
};

/**
 * Extend lifetime of a refreshToken
 */
export async function renewRefreshToken(): Promise<void> {
    const { url, authStore } = helper();

    try {
        const res = await axios.post(`${url}/uauth/renewRefreshToken`, {
            refreshToken: authStore.refreshToken,
        });
        if (!res.data || !res.data.refreshToken) {
            throw new Error('Could not find refreshToken in response');
        }
        authStore.renewRefreshToken(res.data.refreshToken);
        return;
    } catch (e) {
        if (e.response?.data?.error) {
            if (e.response.data.error === UAUTH_ERROR_INVALID_REFRESH_TOKEN) {
                authStore.logout();
                throw new Error('refreshToken has been deleted');
            } else if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                authStore.logout();
                throw new Error('user has been deleted');
            } else {
                throw new Error('unexpected error ocurred' + JSON.stringify(e.response.data));
            }
        } else {
            throw e;
        }
    }
}

/**
 * Get access token from refreshToken
 */
export async function accessTokenFromRefreshToken(): Promise<void> {
    const { url, authStore } = helper();

    try {
        const res = await axios.post(`${url}/uauth/accessTokenFromRefreshToken`, {
            refreshToken: authStore.refreshToken,
        });
        if (!res.data || !res.data.accessToken || !res.data.refreshToken) {
            throw new Error('Could not find accessToken and/or refreshToken in response');
        }
        authStore.login(res.data.accessToken, res.data.refreshToken);
        return;
    } catch (e) {
        if (e.response?.data?.error) {
            if (e.response.data.error === UAUTH_ERROR_INVALID_REFRESH_TOKEN) {
                authStore.logout();
                throw new Error('refreshToken has been deleted');
            } else if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                authStore.logout();
                throw new Error('user has been deleted');
            } else {
                throw new Error('unexpected error ocurred' + JSON.stringify(e.response.data));
            }
        } else {
            throw e;
        }
    }
}

/**
 * Helper for constructing a authed request against the backend (based on axios)
 * @param timeout timeout of the request in milliseconds
 * @param baseURL baseUrl (optional, if nothing is passed the url from AuthStore will be used)
 */
export async function apiRequest(timeout?: number, baseURL: string = AuthStore.get().url): Promise<AxiosInstance> {
    const { authStore } = helper();

    // check if accessToken is still valid
    if (authStore.accessTokenValidUntil && authStore.accessTokenValidUntil < new Date()) {
        // accessToken is not valid anymore
        if (authStore.refreshTokenValidUntil && authStore.refreshTokenValidUntil < new Date()) {
            // refreshToken is not valid anymore
            authStore.logout();
            throw new Error('cannot create apiRequest (accessToken and refreshToken expired)');
        } else {
            // refreshToken is still valid -> get a new accessToken
            await accessTokenFromRefreshToken();
        }
    }

    return axios.create({
        baseURL,
        timeout: timeout || 5000,
        headers: { Authorization: `Bearer ${authStore.accessToken}` },
    });
}

/**
 * Helper for constructing a request to the backend WITHOUT auth (based on axios)
 * @param timeout timeout of the request in milliseconds
 * @param baseURL baseUrl (optional, if nothing is passed the url from AuthStore will be used)
 */
export function apiRequestWithoutAuth(timeout?: number, baseURL: string = AuthStore.get().url): AxiosInstance {
    !baseURL && helper(); // this makes sure url is non empty

    return axios.create({
        baseURL,
        timeout: timeout || 5000,
    });
}

/**
 * Helper for logging in an storing auth-information as needed
 * @param userName userName
 * @param password password in plaintext
 */
export async function login(userName: string, password: string): Promise<void> {
    const { url, authStore } = helper();

    try {
        const res = await axios.post(`${url}/uauth/login`, { user: { userName, password } });
        if (!res.data || !res.data.accessToken || !res.data.refreshToken) {
            throw new Error('Could not find accessToken and/or refreshToken in response');
        }
        authStore.login(res.data.accessToken, res.data.refreshToken);
    } catch (e) {
        authStore.logout();
        if (e.response?.data?.error) {
            if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                throw new Error(e.response.data.error);
            } else {
                throw new Error('unexpected error ocurred' + JSON.stringify(e.response.data));
            }
        } else {
            throw e;
        }
    }
}

/**
 * Helper for deleting the current refreshToken
 * Cleans up authStore and requests deletion of the current token
 */
export async function deleteCurrentRefreshToken(): Promise<void> {
    const { url, authStore } = helper();

    try {
        await (await apiRequest()).post(`${url}/uauth/deleteRefreshToken`, { refreshToken: authStore.refreshToken });
        authStore.logout();
    } catch (e) {
        authStore.logout();
        throw e;
    }
}

/**
 * Helper for deleting any refreshToken of the current user
 * @param refreshToken refreshToken to be deleted
 */
export async function deleteRefreshToken(refreshToken: string): Promise<void> {
    const { url, authStore } = helper();

    try {
        await (await apiRequest()).post(`${url}/uauth/deleteRefreshToken`, { refreshToken: refreshToken });
        if (authStore.refreshToken === refreshToken) authStore.logout();
    } catch (e) {
        throw e;
    }
}

/**
 * Helper for listing refreshTokens of the current user
 */
export async function listRefreshTokens(): Promise<RefreshToken[]> {
    const { url } = helper();

    try {
        const {
            data: { refreshTokens },
        } = await (await apiRequest()).get(`${url}/uauth/listRefreshTokens`);
        return refreshTokens.map((token: string) => {
            const decoded = jwtDecode<RefreshToken>(token);
            decoded.raw = token;
            decoded.issuedAt = new Date(decoded.claims.iat * 1000);
            decoded.expiresAt = new Date(decoded.claims.exp * 1000);
            return decoded;
        });
    } catch (e) {
        throw e;
    }
}

/**
 * Helper for logging out (cleans up AuthStore and tries to delete the current refreshToken)
 */
export async function logout(): Promise<void> {
    return await deleteCurrentRefreshToken();
}
