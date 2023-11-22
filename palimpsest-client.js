let { Mailbox } = require("./util");

let outputN = 0;

const views = [];

const tabId = new Array(32).fill(0).map(n => Math.floor(Math.random() * 16).toString(16)).join('');

const listeners = Mailbox();

const outputSubs = new Map();

const es = new EventSource(`/@events/${tabId}`);
es.onmessage = function({data}) {
    let [tag, val] = JSON.parse(data);
    listeners.send(tag, val);
}

async function onError() {
    es.onerror = () => {};
    while(es.readyState !== 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    for(let n of outputSubs.keys()) {
        fetch(`/@output/${tabId}/${n}`);
    }
    es.onerror = onError;
}
es.onerror = onError;

setTimeout(() => {
    views.sort((l,r) => r.prefix.length - l.prefix.length);
    for(let view of views) {
        if(window.location.pathname.startsWith(view.prefix)) {
            view.fn();
            break;
        }
    }
}, 16);

module.exports = {
    save: async (data) => {
        const result = await fetch(`/@save`, {method: 'POST', body: JSON.stringify(data)});
        return result.text();
    },
    load: async (key) => {
        await fetch(`/@load/${tabId}/${key}`);
        return listeners.receive(key);
    },
    input: (name) => {
        const fn = async (payload) => {
            const result = await fetch(`/@input/${name}`, {method: 'POST', body: JSON.stringify(payload)});
            return Number(await result.text());
        }
        fn.reduce = () => {};
        return fn;
    },
    output: function() {
        let n = outputN++;
        return async function*() {
            if(!outputSubs.has(n)) {
                outputSubs.set(n, 1);
                fetch(`/@output/${tabId}/${n}`);
            } else {
                outputSubs.set(n, outputSubs.get(n) + 1);
            }
            while(true) {
                const next = await listeners.receive(`output:${n}`);
                yield next;
            }
        };
    },
    setRoot: () => {},
    view: (prefix, fn) => {
        views.push({prefix, fn});
    }
}

