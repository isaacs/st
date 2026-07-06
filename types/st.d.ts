export default st;
export type CacheEntryOptions = {
    /**
     * Maximum number of entries to keep.
     */
    max?: number;
    /**
     * Maximum calculated cache size.
     */
    maxSize?: number;
    /**
     * Time in milliseconds before entries expire.
     */
    maxAge?: number | false;
    /**
     * Custom entry size calculation.
     */
    sizeCalculation?: (value: unknown, key?: string) => number;
    /**
     * Explicit Cache-Control response header.
     */
    cacheControl?: string;
};
export type CacheOptions = {
    /**
     * File descriptor cache options.
     */
    fd?: false | CacheEntryOptions;
    /**
     * Stat cache options.
     */
    stat?: false | CacheEntryOptions;
    /**
     * File content cache options.
     */
    content?: false | CacheEntryOptions;
    /**
     * Autoindex HTML cache options.
     */
    index?: false | CacheEntryOptions;
    /**
     * Directory listing cache options.
     */
    readdir?: false | CacheEntryOptions;
};
export type Options = {
    /**
     * Directory to serve from.
     */
    path: string;
    /**
     * URL mount point. Defaults to `/`.
     */
    url?: string;
    /**
     * Autoindex, index filename, or false for directory 404s.
     */
    index?: boolean | string;
    /**
     * Allow dotfiles to be served.
     */
    dot?: boolean;
    /**
     * Cache controls, or false to disable all caches.
     */
    cache?: boolean | CacheOptions;
    /**
     * Call the next handler instead of returning a 404.
     */
    passthrough?: boolean;
    /**
     * Enable gzip when accepted by the client. Defaults to true.
     */
    gzip?: boolean;
    /**
     * Enable permissive CORS headers.
     */
    cors?: boolean;
    /**
     * Add an `x-from-cache` header to cached content responses.
     */
    cachedHeader?: boolean;
};
export type Request = import("node:http").IncomingMessage & {
    sturl?: string | number | false;
    negotiator?: {
        preferredEncoding: (encodings: string[]) => string | undefined;
    };
};
export type ServedRequest = Request & {
    sturl: string;
};
export type Response = import("node:http").ServerResponse & {
    filter?: NodeJS.ReadWriteStream;
    error?: (statusCode: number, error: unknown) => void;
};
export type ServeFunction = (req: Request, res: Response, next?: () => void) => boolean;
export type Handler = ServeFunction & {
    _this: Mount;
};
export class Mount {
    /**
     * @param {Options} opt
     */
    constructor(opt: Options);
    opt: Options;
    url: string;
    path: string;
    _index: string | boolean;
    fdman: any;
    cache: {
        fd: {
            maxSize: number;
            fetch: any;
            has: () => boolean;
            get: () => any;
            set: () => void;
            dump: () => any[];
        } | LRUCache<{}, {}, unknown>;
        stat: {
            maxSize: number;
            fetch: any;
            has: () => boolean;
            get: () => any;
            set: () => void;
            dump: () => any[];
        } | LRUCache<{}, {}, unknown>;
        index: {
            maxSize: number;
            fetch: any;
            has: () => boolean;
            get: () => any;
            set: () => void;
            dump: () => any[];
        } | LRUCache<{}, {}, unknown>;
        readdir: {
            maxSize: number;
            fetch: any;
            has: () => boolean;
            get: () => any;
            set: () => void;
            dump: () => any[];
        } | LRUCache<{}, {}, unknown>;
        content: {
            maxSize: number;
            fetch: any;
            has: () => boolean;
            get: () => any;
            set: () => void;
            dump: () => any[];
        } | LRUCache<{}, {}, unknown>;
    };
    _cacheControl: any;
    /**
     * @param {Options} opt
     */
    getCacheOptions(opt: Options): {
        fd: any;
        stat: any;
        index: any;
        readdir: any;
        content: any;
    };
    /**
     * @param {string} u
     */
    getUriPath(u: string): string | false | 403;
    /**
     * @param {string} u
     */
    getPath(u: string): string | 403;
    /**
     * @param {string} p
     */
    getUrl(p: string): string | false;
    /**
     * @param {Request} req
     * @param {Response} res
     * @param {() => void} [next]
     */
    serve(req: Request, res: Response, next?: () => void): boolean;
    /**
     * @param {NodeJS.ErrnoException | number} er
     * @param {Response} res
     */
    error(er: NodeJS.ErrnoException | number, res: Response): void;
    /**
     * @param {string} p
     * @param {ServedRequest} req
     * @param {Response} res
     */
    index(p: string, req: ServedRequest, res: Response): boolean | void;
    /**
     * @param {string} p
     * @param {ServedRequest} req
     * @param {Response} res
     */
    autoindex(p: string, req: ServedRequest, res: Response): void;
    /**
     * @param {string} p
     * @param {number} fd
     * @param {import('node:fs').Stats} stat
     * @param {string} etag
     * @param {Request} req
     * @param {Response} res
     * @param {() => void} end
     */
    file(p: string, fd: number, stat: import("node:fs").Stats, etag: string, req: Request, res: Response, end: () => void): void;
    /**
     * @param {string} p
     * @param {import('node:fs').Stats} stat
     * @param {string} etag
     * @param {Request} req
     * @param {Response} res
     */
    cachedFile(p: string, stat: import("node:fs").Stats, etag: string, req: Request, res: Response): void;
    /**
     * @param {string} p
     * @param {number} fd
     * @param {import('node:fs').Stats} stat
     * @param {string} etag
     * @param {Request} req
     * @param {Response} res
     * @param {() => void} end
     */
    streamFile(p: string, fd: number, stat: import("node:fs").Stats, etag: string, req: Request, res: Response, end: () => void): void;
    /**
     * @param {string} p
     * @param {(error: NodeJS.ErrnoException | null, data?: Buffer) => void} cb
     */
    _loadIndex(p: string, cb: (error: NodeJS.ErrnoException | null, data?: Buffer) => void): void;
    /**
     * @param {string} p
     * @param {(error: NodeJS.ErrnoException | null, data?: Record<string, import('node:fs').Stats>) => void} cb
     */
    _loadReaddir(p: string, cb: (error: NodeJS.ErrnoException | null, data?: Record<string, import("node:fs").Stats>) => void): void;
    /**
     * @param {string} key
     * @param {(error: NodeJS.ErrnoException | null, data?: import('node:fs').Stats) => void} cb
     */
    _loadStat(key: string, cb: (error: NodeJS.ErrnoException | null, data?: import("node:fs").Stats) => void): void;
    /**
     * @param {string} _
     * @param {(error: Error) => void} cb
     */
    _loadContent(_: string, cb: (error: Error) => void): void;
}
/**
 * Create a static file serving handler.
 *
 * @param {string | Options} opt Path to serve, or full options object.
 * @param {string | Options} [url] Mount URL, or options when the first parameter is a path.
 * @param {Options} [options] Options when the first two parameters are path and URL.
 * @returns {Handler}
 */
declare function st(opt: string | Options, url?: string | Options, options?: Options): Handler;
import { LRUCache } from 'lru-cache';
//# sourceMappingURL=st.d.ts.map