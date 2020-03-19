import axios, { AxiosInstance } from 'axios';
import { User } from './models';
import { AuthStore } from './authStore';

export async function login<T>(userName: string, password: string): Promise<User<T>> {
    const url = AuthStore.get().url;
    if (!url) {
        throw 'URL needs to be configured before usage';
    }
    try {
        const res = await axios.post(`${url}/api/login`, {
            user: { userName, password },
        });
        AuthStore.get().login(res.data.jwt);
        return res.data.user;
    } catch (e) {
        throw e;
    }
}

export function logout(): void {
    AuthStore.get().logout();
}

export function apiRequest(timeout?: number, baseURL: string = AuthStore.get().url): AxiosInstance {
    return axios.create({
        baseURL,
        timeout: timeout || 5000,
        headers: { Authorization: `Bearer ${AuthStore.get().jwtToken}`}
    })
}

export function apiRequestWithoutAuth(timeout?: number, baseURL: string = AuthStore.get().url): AxiosInstance {
    return axios.create({
        baseURL,
        timeout: timeout || 5000,
    })
}
