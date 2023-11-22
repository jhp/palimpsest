let db = require("levelup")(require("leveldown")(__dirname + '/app.ldb'));
let { Mailbox } = require("./util");

let nextId = (function() {
    let id = null;
    return async function() {
        if(!id) {
            try {
                id = JSON.parse(await db.get('id'));
                return id++;
            } catch(e) {
                if(e.notFound) {
                    await db.put('id', JSON.stringify(1000));
                    id = 1;
                } else {
                    throw e;
                }
            }
        }
        if(id % 1000 === 0) {
            await db.put('id', JSON.stringify(id+1000));
        }
        return id++;
    }
})();

let getSession = (function(map) {
    return function(req, res) {
        let cookie = (req.headers['cookie'] || '').split(';').filter(c => c.startsWith('s=')).map(line => line.slice(2).trim())[0];
        if(cookie) return cookie;
        if(!map.has(req)) map.set(req, new Array(32).fill(0).map(n => Math.floor(256*Math.random()).toString(16)).join(''));
        cookie = map.get(req);
        res.setHeader('Set-Cookie', `s=${cookie}; MaxAge=100000000`);
        return cookie;
    }
})(new WeakMap());

function isBuiltin(str) {
    return require("node:module").isBuiltin(str);
}

async function mkBundle(filename) {
    let seenFiles = new Set();
    let obj = "{\n" + (await go(filename)).join(",\n") + "}\n";
    return `
let require = (function(M) {
    return (name) => {
        if(!M[name]) {
            let m = {exports: {}};
            MODULES[ name ](m);
            M[name] = [m.exports];
        }
        return M[name][0];
    }
})({});
let MODULES = ${obj};
require (${JSON.stringify(filename)});
    `;
    return go(filename);
    async function go(fname) {
        if(seenFiles.has(fname)) return [];
        seenFiles.add(fname);
        let ret = [];
        let contentFile = fname === __filename ? __dirname + '/palimpsest-client.js' : fname;
        let pieces = (await require("fs").promises.readFile(contentFile, 'utf8')).split(/require\(\s*(['"][^'"]+['"])\s*\)/);
        for(let ii = 1; ii < pieces.length; ii += 2) {
            let resolved = require.resolve(eval(pieces[ii]), {paths: [require("path").dirname(fname)]});
            pieces[ii] = JSON.stringify(resolved);
            if(!isBuiltin(resolved)) {
                ret.push(...(await go(resolved)));
            }
        }
        ret.push(
            JSON.stringify(fname) + ":" + "function thisModule(module){" + pieces.map((piece, ii) => ii % 2 ? `require (${piece})` : piece).join("") + "}"
        );
        return ret;
    }
}

const inputs = { };

const folds = { };

const outputs = [];

const views = [];

const sockets = new Set();

let root = process.argv[1];
let bundle;

const closedStreams = Mailbox();

const eventStreams = Mailbox();

let initialized = (async () => {
    await new Promise(resolve => setTimeout(resolve, 16));
    bundle = mkBundle(root);
    for(let name of Object.keys(inputs)) {
        for await (const [key, value] of db.iterator({gt: `input:${name}:`, lt: `input:${name};`})) {
            const id = parseInt(`${key}`.split(":").at(-1), 16);
            const [session, val] = JSON.parse(value);
            await Promise.all(folds[name].map(async (elem) => {
                elem.seed = await elem.fn(val, elem.seed, session, id);
            }));
        }
    }
})();

async function handler(req, res, next) {
    await initialized;
    const session = getSession(req, res);
    const path = req.url.split('/').filter(Boolean).map(str => decodeURIComponent(str));
    if(path[0] === '@input') {
        const name = path[1];
        if(inputs[ name ]) {
            const id = await nextId();
            const val = await new Promise(resolve => {
                const chunks = [];
                req.on('data', (chunk) => chunks.push(chunk));
                req.on('end', () => resolve(JSON.parse(chunks.join(''))));
            });
            await db.put(`input:${name}:${id.toString(16).padStart(16, '0')}`, JSON.stringify([session, val]));
            await Promise.all(
                folds[ name ].map(async (elem) => {
                    elem.seed = await elem.fn(val, elem.seed, session, id);
                })
            );
            sockets.forEach(fn => fn());
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end(`${id}`);
        } else {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end('No such input');
        }
    } else if(path[0] === '@output') {
        const tabId = path[1];
        const n = Number(path[2]);
        const output = outputs[n];
        let fn = () => {
            output(session).then(oval => eventStreams.send(tabId, ["output:" + n, oval]));
        }
        sockets.add(fn);
        fn();
        closedStreams.receive(tabId).then(() => sockets.delete(fn));
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('');
    } else if(path[0] === '@save') {
        const val = await new Promise(resolve => {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => resolve(JSON.parse(chunks.join(''))));
        });
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write( await save(val) );
    } else if(path[0] === '@load') {
        const tabId = path[1];
        const key = path[2];
        const val = await load(key);
        eventStreams.send(tabId, [key, val]);
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end();
    } else if(path[0] === '@events') {
        const tabId = path[1];
        res.writeHead(200, {'Content-Type': 'text/event-stream'});
        res.write(`data: ${JSON.stringify(["ping", true])}\n\n`);
        let closed = false;
        res.on('close', () => { 
            closedStreams.send(tabId, true);
            closed = true; 
        });
        (async () => {
            while(true) {
                let next = await eventStreams.receive(tabId);
                if(closed) break;
                res.write(`data: ${JSON.stringify(next)}\n\n`);
            }
        })();
    } else if(views.some(prefix => req.url.startsWith(prefix))) {
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf8'});
        const bundleContent = await bundle;
        res.end(
            `<!doctype html><html><body><script type="text/javascript">${bundleContent}</script>`
        );
    } else {
        console.log(views, req.url);
        if(next) {
            next();
        } else {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.write('Not found');
        }
    }
}

async function save(data) {
    let str = JSON.stringify(data);
    let key = require('crypto').createHash('sha256').update(str).digest('hex');
    await db.put(`hash:${key}`, str);
    return key;
}

async function load(key) {
    return JSON.parse( await db.get(`hash:${key}`) );
}

module.exports = {
    save,
    load,
    input: (name) => {
        inputs[ name ] = [];
        folds[ name ] = [];
        return {
            reduce: (fn, seed) => {
                folds[ name ].push( {fn, seed} );
                let ii = folds[ name ].length - 1;
                return () => folds[ name ][ ii ].seed;
            }
        }
    },
    output: (fn) => {
        outputs.push(fn);
        return outputs.length-1;
    },
    setRoot: (fname) => { root = fname(); },
    view: (prefix, fn) => { views.push(prefix); },
    handler: handler
}
