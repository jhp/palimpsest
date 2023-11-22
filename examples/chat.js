let { input, output, view, listen } = require("../palimpsest");
let { H, A, S, T, E, run, Var } = require("imperative");

const setName = input("chat:username");

const sendMessage = input("chat:message");

const usernames = setName.reduce(async (name, names, session) => ({ ...names, [session]: name}), {});

const messages = sendMessage.reduce(async (msg, msgs, session) => [[session, msg], ...msgs].slice(0, 50), []);

const chats = output(async (userSession) => {
    let lookup = usernames();
    return messages().map(([session, chat]) => [
        (lookup[session] || '<anon>') + (session === userSession ? ' (you)' : ''), 
        chat
    ]).reverse();
});

const myName = output(async (userSession) => {
    return usernames()[ userSession ] || '';
});

function* textInput(label, valueVar=Var('')) {
    yield* H('label',
        T(label),
        H('input', 
            A('type', 'text'), 
            function*() {
                while(true) {
                    let ev = yield* E('input');
                    valueVar.set(ev.target.value);
                }
            },
            valueVar.fmap(value => A('value', value))));
}

view('/chat', function() {
    run(function*() {
        const chatVar = Var(chats());
        const nameVar = Var(myName());
        const msgVar = Var('');
        yield* H('div',
            chatVar.fmap(chats => H('div', (chats || []).map(([name, msg]) => H('div', H('b', T(name)), ' : ', T(msg))))),
            H('div',
                H('span',
                    textInput('name', nameVar),
                    H('button', 'OK', function*() {
                        while(true) {
                            yield* E('click');
                            yield () => setName(nameVar.get());
                        }
                    })),
                H('span',
                    textInput('message', msgVar),
                    H('button', 'OK', function*() {
                        while(true) {
                            yield* E('click');
                            yield () => sendMessage(msgVar.get());
                            msgVar.set('');
                        }
                    }))));
    }(), document.body);
});
