var mongo = require("mongodb");
var ff = require("ff");
var Interface = require("./Interface");

var HOST = "localhost";
var PORT = 27017;

// mongo options
var mongo_options = {
	open: { w: 1, strict: true, safe: true },
	collection: { strict: true },
	insert: { w: 1, strict: true },
	update: { upsert: false, multi: true, w: 1, strict: true },
	find: {}
}

function convertObjectId(conditions) {
	if (conditions._id) {
		try {
			conditions._id = new mongo.ObjectID(conditions._id)
		} catch (er) {}
	}
}

var Mongo = Interface.extend({
	open: function (config, next) {
		// setup the mongo connection
		this.connection = new mongo.Db(
			config.name, 
			new mongo.Server(config.host || HOST, config.port || PORT), 
			mongo_options.open
		);

		this.connection.open(next);
	},

	createTable: function (table, fields, next) {
		var self = this;
		this.connection.createCollection(table, mongo_options.open, function () {
			// create unique indexes
			for (var key in fields) {
				var rule = fields[key];
				if (rule.unique) {
					var ufields = {};
					ufields[key] = 1;
					self.createIndex(table, ufields, {unique: true});
				}
			}

			// ignore any error for now
			next();
		})
	},

	createIndex: function (table, fields, config, next) {
		var f = ff(this, function () {
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, function (collection) {
			collection.ensureIndex(fields, config, f.slot());
		}).cb(next);
	},

	read: function (table, conditions, options, references, next) {
		if (conditions._id) {
			conditions._id = new mongo.ObjectID(conditions._id)
		}

		if (options['search']) {
			return this.search(table, options['search'], next);
		}

		if (options['in']) {
			var inOpts = options['in'];
			var key = Object.keys(inOpts)[0];

			if (key == '_id') { // TODO: include keys with rule.type == id
				for (var i = 0; i < inOpts[key].length; ++i) {
					try {
						inOpts[key][i] = mongo.ObjectID(inOpts[key][i])
					} catch (e) {}
				}
			}

			conditions[key] = {'$in': inOpts[key]};
			options = {};
		}

		var f = ff(this, function () {
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, function (collection) {
			// plain aggregation stack
			var stack = [
				{
					'$match': conditions
				}
			];

			// handle references if we have any
			for(var reference in references) {
				stack.push({
					'$lookup': references[reference]
				});
			}

			// do it
			collection.aggregate(stack, options, f.slot());
		}).cb(next);
	},

	write: function (table, conditions, data, next) {
		for (var i in conditions['references']) {
			var reference = conditions['references'][i];
			if(data[reference])
				data[reference] = new mongo.ObjectID(data[reference]);
		}

		delete conditions['references'];

		var f = ff(this, function () {
			console.log("BAH", data)
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, function (collection) {
			console.log("WRITE", data)
			collection.insert(data, mongo_options.insert, f.slot());
		}).cb(next);
	},

	modify: function (table, conditions, data, next) {
		convertObjectId(conditions);

		for (var i in conditions['references']) {
			var reference = conditions['references'][i];
			if(data[reference])
				data[reference] = new mongo.ObjectID(data[reference]);
		}

		delete conditions['references'];

		console.log("GOING IN", data);

		var f = ff(this, function () {
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, function (collection) {
			console.log("MODIFY", conditions, data)
			collection.update(conditions, {"$set": data}, mongo_options.update, f.slot());
		}).cb(next);
	},

	remove: function (table, conditions, next) {
		convertObjectId(conditions);

		var f = ff(this, function () {
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, function (collection) {
			collection.remove(conditions, mongo_options.remove, f.slot());
		}).cb(next);
	},

	increment: function (table, conditions, data, next) {
		convertObjectId(conditions);

		var f = ff(this, function () {
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, function (collection) {
			console.log(conditions, {"$inc": data})
			collection.update(conditions, {"$inc": data}, mongo_options.modify, f.slot());
		}).cb(next);
	}
});

module.exports = Mongo;