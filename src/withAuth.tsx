import * as React from 'react';
import { ConnectToAuthProps, UAuthProps } from './models';
import { AuthStore, Unsubscribe } from './authStore';

export const WithAuth = <P extends object>(Component: React.ComponentType<P>, LoginComponent: React.ComponentType<P>) =>
    class ConnectedComponent extends React.Component<P & ConnectToAuthProps> {
        state: UAuthProps = {
            user: undefined,
            loggedIn: false,
            accessToken: undefined,
            accessTokenValidUntil: undefined,
            refreshToken: undefined,
            refreshTokenValidUntil: undefined,
        };
        unsubscribe?: Unsubscribe;

        componentDidMount() {
            const initialProps = AuthStore.get().props;
            this.setState({ ...initialProps });

            this.unsubscribe = AuthStore.get().addSubscriber((props: UAuthProps) => {
                this.setState({ ...props });
            });
        }

        componentWillUnmount() {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
        }

        render() {
            if (this.state?.loggedIn) {
                return <Component {...(this.props as P)} uauth={this.state} />;
            }
            return <LoginComponent {...(this.props as P)} />;
        }
    };
