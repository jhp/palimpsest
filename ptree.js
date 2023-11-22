const { load, save } = require("./palimpsest");

async function insert(tree, key, value, merge=(l,r) => r) {
    let ret = await go(tree ? await load(tree) : tree, key, value, merge);
    if(ret.length === 1) return save(ret[0]);
    return save(ret);

    async function go(tree, key, value, merge) {
        if(!tree) return [null, [key, value], null];
        let idx;
        for(idx = 0; idx < tree.length-1 && tree[idx+1][0] <= key; idx += 2) {
            if(tree[idx+1][0] === key)
                return [await save([...tree.slice(0, idx+1), [key, await merge(tree[idx+1][1], value)], ...tree.slice(idx+2)])];
        }
        let ret = [...tree.slice(0, idx), ...(await go(tree[idx], key, value, merge)), ...tree.slice(idx+1)];
        if(ret.length <= 5) return [await save(ret)];
        return [ret.slice(0,3), ret[3], ret.slice(4)];
    }
}

async function lookup(tree, key) {
    if(!tree) return null;
    let tval = load(tree);
    for(let ii = 1; ii < tval.length; ii++) {
        if(tval[ii][0] === key) return tval[ii][1];
        if(tval[ii][0] > key) return lookup(tval[ii-1], key);
    }
    return lookup(tval[ tval.length - 1 ], key);
}

module.exports = {insert, lookup};
