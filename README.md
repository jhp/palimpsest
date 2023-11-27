Palimpsest
==========

Palimpsest is a new web framework which takes a fresh approach to some of the longstanding conventions of the genre.

Instead of "routes" which run arbitrary code, Palimpsest divides an application
into "inputs", "folds", "outputs", and "views". An "input" is more or less a
dumb bucket for user input. A fold transforms that raw data into useful
formats. An output provides a live readout of user-customized data from one or
more folds. And a view shows output data to the user, and sends user input to
inputs.

Why organize things in this way? Because inputs are a raw data record, they can
be reused as a program evolves to serve different purposes. Because folds are
an immutable summary of inputs, rather than an imperative "action" effecting
database state, they can be rerun at will. Because outputs are a live event
stream, Palimpsest applications are live by default, with no extra effort
required to make reactive widgets like chat. Because Palimpsest stores its data
as immutable records in a key-value store, rather than mutable database tables,
caching can be done correctly without constant programmer input and effort. 

Comprehensive documentation is on the way, but for now you can find examples
within the example directory, and some explanatory content at [my
blog](https://jasonhpriestley.com).
