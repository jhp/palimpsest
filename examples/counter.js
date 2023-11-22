let { input, output, view, listen } = require("../palimpsest");
let { H, A, S, T, E, run, Var } = require("imperative");

const click = input("counter:click");

const counter = click.reduce(async (k, n) => n + k, 0);

const currentCount = output(async () => counter());

view('/counter', function() {
    run(function*() {
        const clickVar = Var(currentCount());
        while(true) {
            yield* H('button', 
                clickVar.fmap(v => v === undefined ? T('.') : T(v)), 
                function*() { 
                    while(true) { 
                        yield* E('click');
                        yield () => click(1);
                    }
                });
        }
    }());
});
