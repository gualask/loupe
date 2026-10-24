import type { Config } from './config.ts';
import type { Db } from './db/client.ts';
import type { UserRow } from './db/users.ts';

export type AppDeps = { db: Db; config: Config };

export type AppEnv = {
    Variables: {
        /** The signed-in admin or editor, or null for anonymous requests. */
        user: UserRow | null;
    };
};
