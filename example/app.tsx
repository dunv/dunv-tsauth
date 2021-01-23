import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { UAuth, useApiRequest, useApiRequestWithoutAuth, useLogin, useLogout, useUser } from '../src/hooks';
import { PrivateRoute } from '../src/PrivateRoute';

const LoggedInComponent: React.FC = () => {
    const logout = useLogout();
    const apiRequest = useApiRequest();
    const user = useUser();

    const handleLogout: React.ReactEventHandler = async (e) => {
        e.preventDefault();
        logout();
    };

    const handleRandomRequest = async () => {
        const instance = await apiRequest();
        try {
            const { data } = await instance.get('api/report');
            console.log(data);
        } catch (e) {
            console.log(JSON.stringify(e?.response?.data));
        }
    };

    return (
        <div>
            <button onClick={handleRandomRequest}>RandomRequest</button>
            <button onClick={handleLogout}>Logout</button>
            {user && <pre>{JSON.stringify(user, null, 2)}</pre>}
        </div>
    );
};

const LoginForm: React.FC = () => {
    const login = useLogin();
    const apiRequestWithoutAuth = useApiRequestWithoutAuth();

    const [input, setInput] = React.useState({ user: '', password: '' });
    const [isLoading, setIsLoading] = React.useState(false);
    const [loginError, setLoginError] = React.useState('');

    const handleLogin: React.ReactEventHandler = async (e) => {
        e.preventDefault();
        const { user, password } = input;
        if (user && password) {
            setIsLoading(true);
            try {
                await login(user.toLocaleLowerCase(), password);
            } catch (error) {
                console.log(error);
                setLoginError(error);
                setIsLoading(false);
            }
        }
    };

    const handleRandomRequestWithoutAuth = async () => {
        const instance = await apiRequestWithoutAuth();
        try {
            const { data } = await instance.get('api/report');
            console.log(data);
        } catch (e) {
            console.log(JSON.stringify(e?.response?.data));
        }
    };

    const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        setLoginError('');
        setInput({
            ...input,
            [e.currentTarget.name]: e.currentTarget.value,
        });
    };

    return (
        <div>
            <form>
                <input type="text" placeholder="user" name="user" autoComplete="name" onChange={handleInputChange}></input>
                <input type="password" placeholder="password" name="password" autoComplete="password" onChange={handleInputChange}></input>
                {(!isLoading && <button onClick={handleLogin}>Login</button>) || <div>...loading</div>}
                {loginError && <div>Invalid user/password</div>}
            </form>
            <br />
            <br />
            <button onClick={handleRandomRequestWithoutAuth}>RandomRequestWithoutAuth</button>
            <br />
            <br />
        </div>
    );
};

const rootDiv = document.createElement('div');
rootDiv.id = 'root';
document.body.appendChild(rootDiv);

ReactDOM.render(
    <BrowserRouter>
        <UAuth url={'http://localhost:8080'}>
            <PrivateRoute path="/" exact component={LoggedInComponent} loginComponent={LoginForm} />
        </UAuth>
    </BrowserRouter>,
    document.getElementById('root')
);
