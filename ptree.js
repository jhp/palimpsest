const { load, save } = require("./palimpsest");

async function insert(tree, key, value, merge=(l,r) => r) {
    let ret = await go(tree ? await load(tree) : tree, key, value, merge);
    if(ret.length === 1) return ret[0];
    return save(ret);

    async function go(tree, key, value, merge) {
        if(!tree) return [null, [key, value], null];
        let idx;
        for(idx = 0; idx < tree.length-1 && tree[idx+1][0] <= key; idx += 2) {
            if(tree[idx+1][0] === key)
                return [await save([...tree.slice(0, idx+1), [key, await merge(tree[idx+1][1], value)], ...tree.slice(idx+2)])];
        }
        let ret = [
            ...tree.slice(0, idx), 
            ...(await go(tree[idx] ? await load(tree[idx]) : tree[idx], key, value, merge)), 
            ...tree.slice(idx+1)
        ];
        if(ret.length <= 5) return [await save(ret)];
        return [await save(ret.slice(0,3)), ret[3], await save(ret.slice(4))];
    }
}

async function lookup(tree, key) {
    if(!tree) return null;
    let tval = await load(tree);
    for(let ii = 1; ii < tval.length; ii += 2) {
        if(tval[ii][0] === key) return tval[ii][1];
        if(tval[ii][0] > key) return lookup(tval[ii-1], key);
    }
    return lookup(tval[ tval.length - 1 ], key);
}

async function* iterate(tree) {
    if(!tree) return;
    let tval = await load(tree);
    for(let ii = 0; ii < tval.length; ii++) {
        if(ii % 2) {
            yield tval[ii];
        } else {
            yield* iterate(tval[ii]);
       }
    }
}

async function* reverseIterate(tree) {
    if(!tree) return;
    let tval = await load(tree);
    for(let ii = tval.length-1; ii >= 0; ii--) {
        if(ii % 2) {
            yield tval[ii];
        } else {
            yield* reverseIterate(tval[ii]);
        }
    }
}

module.exports = {insert, lookup, iterate, reverseIterate};
