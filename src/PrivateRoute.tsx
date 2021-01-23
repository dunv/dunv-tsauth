import * as React from 'react';
import { Route, RouteComponentProps, RouteProps } from 'react-router-dom';
import { useIsLoggedIn } from './hooks';

type PrivateRouteProps = RouteProps & { loginComponent: React.ComponentType<RouteComponentProps<any>> | React.ComponentType<any> };

export const PrivateRoute: React.FC<PrivateRouteProps> = (props: PrivateRouteProps) => {
    const isLoggedIn = useIsLoggedIn();
    if (isLoggedIn) {
        return <Route {...props} component={props.component} />;
    }
    return <Route {...props} component={props.loginComponent} />;
};
