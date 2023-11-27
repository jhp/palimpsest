let { input, output, view, listen } = require("../palimpsest");
let { H, A, S, T, E, run, Var } = require("imperative");

const hash = (input) => require("crypto").createHash("sha256").update(input).digest("hex");

const signup = input("auth:signup", {filter: ([name, pass]) => [
    name, 
    hash(pass)
]});

const updatePassword = input("auth:changepass", {filter: ([name, oldpass, newpass]) => [
    name,
    hash(oldpass),
    hash(newpass)
]});

const login = input("auth:login", {filter: ([name, pass]) => [
    name,
    hash(pass)
]});

const logout = input("auth:logout");

const userSessions = signup.fold(async ([name, pass], [users, sessions], session) => {
    if(!users[name]) {
        return [{...users, [name]: pass}, {...sessions, [session]: name}];
    } else {
        return [users, sessions];
    }
}, [{}, {}]);

updatePassword.fold(async ([oldpass, newpass], [users, sessions], session) => {
    if(sessions[session] && users[ sessions[ session ] ] && users[ sessions[ session ] ] === oldpass) {
        return [{...users, [sessions[session]]: newpass}, sessions];
    } else {
        return [users, sessions];
    }
}, userSessions);

login.fold(async ([name, pass], [users, sessions], session) => {
    if(users[ name ] && users[ name ] === pass) {
        return [users, {...sessions, [session]: name}];
    } else {
        return [users, sessions];
    }
}, userSessions);

logout.fold(async (_, [users, sessions], session) => {
    return [users, {...sessions, [session]: undefined}];
}, userSessions);

const me = output(async (userSession) => {
    return [userSessions.id, userSessions()[ 1 ][ userSession ] || null];
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

view('/palimpsest-auth', function() {
    run(function*() {
        const meVar = Var(me());
        const nameVar = Var('');
        const passVar = Var('');
        yield* H('div',
            meVar.fmap(me => me && me[1] ? H('div', `logged in as ${me[1]}`) : H('div', 'logged out')),
            textInput('name', nameVar),
            textInput('pass', passVar),
            H('button', S('display', 'block'), 'signup', function*() {
                while(true) {
                    yield* E('click');
                    yield () => signup([nameVar.get(), passVar.get()]);
                }
            }),
            H('button', S('display', 'block'), 'login', function*() {
                while(true) {
                    yield* E('click');
                    yield () => login([nameVar.get(), passVar.get()]);
                }
            }),
            H('button', S('display', 'block'), 'logout', function*() {
                while(true) {
                    yield* E('click');
                    yield () => logout(0);
                }
            })
        );
    }(), document.body);
});
