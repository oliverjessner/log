import cokie from '@hapi/cookie';
import { validate, login, logout, checkPassword, changePassword } from '../controller/auth';
import { strictRouteOptions } from '../data/routeOptions';
export default async function auth(server) {
    await server.register(cokie);
    server.auth.strategy('session', 'cookie', {
        cookie: {
            name: 'log-cookie',
            password: process.env.COOKIE_PASSWORD,
            isSecure: true,
        },
        redirectTo: 'v1/login/',
        validate,
    });
    server.auth.default('session');
    server.route([
        {
            method: 'POST',
            path: '/v1/login',
            handler: login,
            options: {
                auth: {
                    mode: 'try',
                    strategy: 'session',
                },
            },
        },
        {
            method: 'POST',
            path: '/v1/changePassword',
            handler: changePassword,
            options: strictRouteOptions,
        },
        {
            method: 'POST',
            path: '/v1/checkPassword',
            handler: checkPassword,
            options: strictRouteOptions,
        },
        {
            method: 'GET',
            path: '/v1/logout',
            handler: logout,
            options: strictRouteOptions,
        },
    ]);
}
