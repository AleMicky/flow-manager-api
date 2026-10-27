
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

export async function createSessionMiddleware() {
    const url = process.env.REDIS_URL;
    const secret = process.env.SESSION_SECRET;

    if (!url || !secret || secret.length < 32) {
        throw new Error(
            'REDIS_URL y SESSION_SECRET seguro son requeridos',
        );
    }

    const redis = createClient({ url });

    redis.on('error', (error) => {
        console.error('Redis sessions:', error);
    });

    await redis.connect();

    const middleware = session({
        name:
            process.env.NODE_ENV === 'production'
                ? '__Host-flow.sid'
                : 'flow.sid',

        store: new RedisStore({
            client: redis,
            prefix: 'flow-manager:sessions:',
        }),

        secret,
        resave: false,
        saveUninitialized: false,
        rolling: true,

        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 1000,
        },
    });

    return {
        middleware,
        close: () => redis.quit(),
    };
}
