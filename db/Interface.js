const Class = require("../lib/Class");
const Error = require("../lib/Error");

const Interface = Class.extend({
	connection: null,

	// config:
	//    - name: Name of the database
	//    - host:
	//    - post: 
	open(config, next) {
		throw new Error("Method not implemented: open")
	},

	createTable(table, fields, next) {
		throw new Error("Method not implemented: createTable")
	},

	createIndex(table, fields, config, next) {
		throw new Error("Method not implemented: createIndex")	
	},

	read(table, conditions, options, next) {
		throw new Error("Method not implemented: read")
	},

	write(table, data, next) {
		throw new Error("Method not implemented: write")
	},

	modify(table, conditions, data, next) {
		throw new Error("Method not implemented: modify")
	},

	remove(table, conditions, next) {
		throw new Error("Method not implemented: remove")
	},

	increment(table, data, next) {
		throw new Error("Method not implemented: increment")	
	}
});

module.exports = Interface;