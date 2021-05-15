import axios, { AxiosInstance } from 'axios';
import { UAUTH_ERROR_INVALID_REFRESH_TOKEN, UAUTH_ERROR_INVALID_USER } from './AuthContext';
import { RawTokens, Tokens } from './models';
import { UAUTH_URL_ACCESS_TOKEN_FROM_REFRESH_TOKEN, UAUTH_URL_DELETE_REFRESH_TOKEN, UAUTH_URL_RENEW_REFRESH_TOKEN } from './urls';

/**
 * INTERNAL: deleteRefreshToken
 */
export const _deleteRefreshToken = async (
    url: string,
    debug: boolean,
    refreshToken: string,
    rawTokens: RawTokens | undefined,
    setRawTokens: (rawTokens?: RawTokens) => void,
    tokens: Tokens
): Promise<void> => {
    if (!rawTokens) {
        debug && console.log('dunv-tsauth: cannot delete refreshToken when not logged in');
        return;
    }

    try {
        debug && console.log('dunv-tsauth: deleting refreshToken...');
        const req = await _apiRequest(url, rawTokens, setRawTokens, tokens, debug);
        await req.post(`${url}${UAUTH_URL_DELETE_REFRESH_TOKEN}`, { refreshToken });
        if (refreshToken === rawTokens?.refreshToken) {
            debug && console.log('dunv-tsauth: - deleted current refreshToken (-> implicit logout)');
            setRawTokens(undefined);
        }
        debug && console.log('dunv-tsauth: ...success deleting refreshToken');
    } catch (e) {
        debug && console.log(`dunv-tsauth: ...failed deleting current refreshToken (${e})`);
        throw e;
    }
};

/**
 * INTERNAL: apiRequest
 */
export const _apiRequest = async (
    url: string,
    rawTokens: RawTokens,
    setRawTokens: (rawTokens?: RawTokens) => void,
    tokens: Tokens,
    debug: boolean,
    timeout = 5000
): Promise<AxiosInstance> => {
    const accessTokenValid = new Date(tokens.accessToken.claims.exp * 1000) > new Date();
    const refreshTokenValid = new Date(tokens.refreshToken.claims.exp * 1000) > new Date();
    // const remainingAccessTokenValidity = (new Date(tokens.accessToken.claims.exp * 1000).getTime() - new Date().getTime()) / 1000;
    const remainingRefreshTokenValidity = (new Date(tokens.refreshToken.claims.exp * 1000).getTime() - new Date().getTime()) / 1000;
    // const totalAccessTokenValidity =
    //     (new Date(tokens.accessToken.claims.exp * 1000).getTime() - new Date(tokens.accessToken.claims.iat * 1000).getTime()) / 1000;
    const totalRefreshTokenValidity =
        (new Date(tokens.refreshToken.claims.exp * 1000).getTime() - new Date(tokens.refreshToken.claims.iat * 1000).getTime()) / 1000;

    // console.log(
    //     `accessToken remaining:${remainingAccessTokenValidity}s (${
    //         Math.round((remainingAccessTokenValidity / totalAccessTokenValidity) * 100 * 100) / 100
    //     }%)`
    // );
    // console.log(
    //     `refreshToken remaining:${remainingRefreshTokenValidity}s (${
    //         Math.round((remainingRefreshTokenValidity / totalRefreshTokenValidity) * 100 * 100) / 100
    //     }%)`
    // );

    // renew refreshToken if nearing its expiry
    if (remainingRefreshTokenValidity / totalRefreshTokenValidity < 0.5 && refreshTokenValid) {
        debug && console.log('dunv-tsauth: less than 50% of refreshTokenValidity remaining -> refreshing now');
        const updatedRawTokens = await _renewRefreshToken(url, rawTokens);
        setRawTokens(updatedRawTokens);
        return axios.create({ baseURL: url, timeout, headers: { Authorization: `Bearer ${updatedRawTokens.accessToken}` } });
    }

    // get accessToken if refreshToken is still valid but not nearing its expiry
    if (!accessTokenValid && refreshTokenValid) {
        console.log('dunv-tsauth: accessToken expired, refreshing it using refreshToken');
        const updatedRawTokens = await _accessTokenFromRefreshToken(url, rawTokens);
        setRawTokens(updatedRawTokens);
        return axios.create({ baseURL: url, timeout, headers: { Authorization: `Bearer ${updatedRawTokens.accessToken}` } });
    }

    // if access token is still valid, just use it
    if (accessTokenValid) {
        return axios.create({ baseURL: url, timeout, headers: { Authorization: `Bearer ${rawTokens.accessToken}` } });
    }

    // if all tokens expired, the only thing remaining is logging in again
    debug && console.log('dunv-tsauth: accessToken and refreshToken expired');
    setRawTokens(undefined);
    throw new Error('cannot create apiRequest (accessToken and refreshToken expired)');
};

/**
 * INTERNAL: Get access token from refreshToken
 * only getter, will not change state
 */
export const _accessTokenFromRefreshToken = async (url: string, rawTokens: RawTokens): Promise<RawTokens> => {
    if (!rawTokens) throw new Error('needs to be authorized first');
    try {
        const res = await axios.post(`${url}${UAUTH_URL_ACCESS_TOKEN_FROM_REFRESH_TOKEN}`, { refreshToken: rawTokens?.refreshToken });
        if (!res.data || !res.data.accessToken || !res.data.refreshToken) {
            throw new Error('Could not find accessToken and/or refreshToken in response');
        }
        return { accessToken: res.data.accessToken, refreshToken: res.data.refreshToken };
    } catch (e) {
        if (e.response?.data?.error) {
            if (e.response.data.error === UAUTH_ERROR_INVALID_REFRESH_TOKEN) {
                throw new Error('refreshToken has been deleted');
            } else if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                throw new Error('user has been deleted');
            }
        }
        throw new Error('unexpected error ocurred' + JSON.stringify(e));
    }
};

/**
 * INTERNAL: Extend lifetime of a refreshToken
 * only getter, will not change state
 */
export const _renewRefreshToken = async (url: string, rawTokens: RawTokens): Promise<RawTokens> => {
    if (!rawTokens) throw new Error('needs to be authorized first');
    try {
        const res = await axios.post(`${url}${UAUTH_URL_RENEW_REFRESH_TOKEN}`, { refreshToken: rawTokens.refreshToken });
        if (!res.data || !res.data.refreshToken) {
            throw new Error('Could not find refreshToken in response');
        }
        return { accessToken: res.data.accessToken, refreshToken: res.data.refreshToken };
    } catch (e) {
        if (e.response?.data?.error) {
            if (e.response.data.error === UAUTH_ERROR_INVALID_REFRESH_TOKEN) {
                throw new Error('refreshToken has been deleted');
            } else if (e.response.data.error === UAUTH_ERROR_INVALID_USER) {
                throw new Error('user has been deleted');
            }
        }
        throw new Error('unexpected error ocurred' + JSON.stringify(e.response.data));
    }
};
