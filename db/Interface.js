var Class = require("../lib/Class");
var Error = require("../lib/Error");

var Interface = Class.extend({
	connection: null,

	// config:
	//    - name: Name of the database
	//    - host:
	//    - post: 
	open: function (config, next) {
		throw new Error("Method not implemented: open")
	},

	createTable: function (table, fields, next) {
		throw new Error("Method not implemented: createTable")
	},

	createIndex: function (table, fields, config, next) {
		throw new Error("Method not implemented: createIndex")	
	},

	read: function (table, conditions, options, next) {
		throw new Error("Method not implemented: read")
	},

	write: function (table, data, next) {
		throw new Error("Method not implemented: write")
	},

	modify: function (table, conditions, data, next) {
		throw new Error("Method not implemented: modify")
	},

	remove: function (table, conditions, next) {
		throw new Error("Method not implemented: remove")
	},

	increment: function (table, data, next) {
		throw new Error("Method not implemented: increment")	
	}
});

module.exports = Interface;