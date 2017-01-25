var RiakDB = require("../db/Riak")
var db = new RiakDB();
db.open({name: "test"});

db.write("test", {car: "nope"}, function() {
	console.log("WRITE", arguments);

	db.read("test", {}, {}, [], function () {
		console.log("READ", arguments);
	});
});