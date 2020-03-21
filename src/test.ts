import { AuthStore } from './authStore';
import { login, logout, apiRequest } from './helpers';
import { User } from './models';

AuthStore.get().url = 'http://localhost:8080';

const cookieDetailsEl = document.getElementById('user-details-from-cookie')! as HTMLPreElement;
cookieDetailsEl.innerText = JSON.stringify(AuthStore.get().user(), undefined, 2);
const subscriber = AuthStore.get().addSubscriber((_: boolean, user?: User<any>) => {
    cookieDetailsEl.innerText = JSON.stringify(user, undefined, 2);
});

const loginButton = document.getElementById('login-button')! as HTMLButtonElement;
const userNameEl = document.getElementById('user-name-input')! as HTMLInputElement;
const passwordEl = document.getElementById('password-input')! as HTMLInputElement;
const requestErrorEl = document.getElementById('request-error')! as HTMLPreElement;
loginButton.addEventListener('click', () => {
    login<string>(userNameEl.value, passwordEl.value)
        .then(() => {
            requestErrorEl.innerText = '';
        })
        .catch(e => {
            console.log('error', e);
            requestErrorEl.innerText = JSON.stringify(e, undefined, 2);
        });
});

const logoutButton = document.getElementById('logout-button')! as HTMLButtonElement;
logoutButton.addEventListener('click', () => {
    logout();
});

const removeSubscriberButton = document.getElementById('remove-subscriber-button')! as HTMLButtonElement;
removeSubscriberButton.addEventListener('click', () => {
    subscriber();
});

const fireRequestButton = document.getElementById('fire-request-button')! as HTMLButtonElement;
fireRequestButton.addEventListener('click', () => {
    apiRequest().get('/api/getUser', { params: {
        userId: AuthStore.get().user()?.id
    }}).then((res: any) => {
        console.log(res.data);
    }).catch((e: any) => console.log(JSON.stringify(e)))
});
