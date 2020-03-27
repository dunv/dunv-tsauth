import axios, { AxiosInstance } from 'axios';
import { AuthStore } from './authStore';

export const UAUTH_ERROR_INVALID_REFRESH_TOKEN = 'ErrInvalidRefreshToken';
export const UAUTH_ERROR_INVALID_USER = 'ErrInvalidUser';

export async function renewRefreshToken(): Promise<void> {
    const authStore = AuthStore.get();
    const url = authStore.url;
    if (!url) {
        throw 'URL needs to be configured before usage';
    }
    try {
        const res = await axios.post(`${url}/uauth/renewRefreshToken`, {
            refreshToken: authStore.refreshToken,
        });
        if (!res.data || !res.data.refreshToken) {
            throw 'Could not find refreshToken in response';
        }
        authStore.renewRefreshToken(res.data.refreshToken);
        return;
    } catch (e) {
        if (e.response?.data?.error) {
            if (e.response.data.error === UAUTH_ERROR_INVALID_REFRESH_TOKEN) {
                authStore.logout();
                throw 'refreshToken has been deleted';
            } else if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                authStore.logout();
                throw 'user has been deleted';
            } else {
                throw 'unexpected error ocurred' + JSON.stringify(e.response.data);
            }
        } else {
            throw e;
        }
    }
}

export async function accessTokenFromRefreshToken(): Promise<void> {
    const authStore = AuthStore.get();
    const url = authStore.url;
    if (!url) {
        throw 'URL needs to be configured before usage';
    }
    try {
        const res = await axios.post(`${url}/uauth/accessTokenFromRefreshToken`, {
            refreshToken: authStore.refreshToken,
        });
        if (!res.data || !res.data.accessToken || !res.data.refreshToken) {
            throw 'Could not find accessToken and/or refreshToken in response';
        }
        authStore.login(res.data.accessToken, res.data.refreshToken);
        return;
    } catch (e) {
        if (e.response?.data?.error) {
            if (e.response.data.error === UAUTH_ERROR_INVALID_REFRESH_TOKEN) {
                authStore.logout();
                throw 'refreshToken has been deleted';
            } else if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                authStore.logout();
                throw 'user has been deleted';
            } else {
                throw 'unexpected error ocurred' + JSON.stringify(e.response.data);
            }
        } else {
            throw e;
        }
    }
}

export async function apiRequest(timeout?: number, baseURL: string = AuthStore.get().url): Promise<AxiosInstance> {
    const authStore = AuthStore.get();
    if (!authStore.isLoggedIn) {
        throw 'cannot create apiRequest (user is not logged in)';
    }

    // check if accessToken is still valid
    if (authStore.accessTokenValidUntil && authStore.accessTokenValidUntil < new Date()) {
        // accessToken is not valid anymore
        if (authStore.refreshTokenValidUntil && authStore.refreshTokenValidUntil < new Date()) {
            // refreshToken is not valid anymore
            throw 'cannot create apiRequest (accessToken and refreshToken expired)';
        } else {
            // refreshToken is still valid -> get a new accessToken
            console.debug('renewing accessToken');
            await accessTokenFromRefreshToken();
        }
    }

    return axios.create({
        baseURL,
        timeout: timeout || 5000,
        headers: { Authorization: `Bearer ${AuthStore.get().accessToken}` },
    });
}

export function apiRequestWithoutAuth(timeout?: number, baseURL: string = AuthStore.get().url): AxiosInstance {
    return axios.create({
        baseURL,
        timeout: timeout || 5000,
    });
}

export async function login(userName: string, password: string): Promise<void> {
    const authStore = AuthStore.get();
    const url = authStore.url;
    if (!url) {
        throw 'URL needs to be configured before usage';
    }
    try {
        const res = await axios.post(`${url}/uauth/login`, {
            user: { userName, password },
        });
        if (!res.data || !res.data.accessToken || !res.data.refreshToken) {
            throw 'Could not find accessToken and/or refreshToken in response';
        }

        authStore.login(res.data.accessToken, res.data.refreshToken);
        return;
    } catch (e) {
        if (e.response?.data?.error) {
            if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                console.log('wrong credentials');
                authStore.logout();
            } else {
                throw 'unexpected error ocurred' + JSON.stringify(e.response.data);
            }
        } else {
            throw e;
        }
    }
}

export async function deleteRefreshToken(): Promise<void> {
    const url = AuthStore.get().url;
    if (!url) {
        throw 'URL needs to be configured before usage';
    }
    try {
        await (await apiRequest()).post(`${url}/uauth/deleteRefreshToken`, {
            refreshToken: AuthStore.get().refreshToken,
        });
        AuthStore.get().logout();
        return;
    } catch (e) {
        throw e;
    }
}

export async function logout(): Promise<void> {
    return await deleteRefreshToken();
}
