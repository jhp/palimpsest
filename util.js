function Mailbox() {
    let inputs = {};
    let listeners = {};

    return {
        send(name, value) {
            if(listeners[ name ] && listeners[ name ].length) {
                let fns = listeners[name];
                listeners[ name ] = [];
                fns.map(fn => fn(value));
            } else {
                inputs[ name ] = inputs[ name ] || [];
                inputs[ name ].push( value );
            }
        },
        async receive(name) {
            if(inputs[name] && inputs[name].length) {
                return inputs[name].shift()
            } else {
                return new Promise((resolve) => {
                    listeners[name] = listeners[name] || [];
                    listeners[name].push(resolve);
                });
            }
        }
    }
}

module.exports  = { Mailbox };
