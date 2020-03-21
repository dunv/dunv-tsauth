import * as React from 'react';
import axios, { AxiosInstance } from 'axios';
import { User } from './models';
import { AuthStore, Unsubscribe } from './authStore';

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

export const ConnectToAuth = <P extends object>(Component: React.ComponentType<P>) =>
    class ConnectedComponent extends React.Component<object> {
        state = {
            user: undefined,
            loggedIn: false,
        };
        unsubscribe?: Unsubscribe;

        componentDidMount() {
            const user = AuthStore.get().user();
            if (user) {
                this.setState({ user, loggedIn: true });
            }

            this.unsubscribe = AuthStore.get().addSubscriber((loggedIn: boolean, user?: User<any>) => {
                this.setState({ loggedIn, user });
            });
        }

        componentWillUnmount() {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
        }

        render() {
            const { user, loggedIn } = this.state;
            return <Component {...(this.props as P)} loggedIn={loggedIn} user={user} />;
        }
    };
