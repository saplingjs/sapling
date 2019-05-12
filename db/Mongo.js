const mongo = require("mongodb");
const ff = require("ff");
const Interface = require("./Interface");

const HOST = "localhost";
const PORT = 27017;

// mongo options
const mongo_options = {
	open: { w: 1, strict: true, safe: true },
	collection: { strict: true },
	insert: { w: 1, strict: true },
	update: { upsert: false, multi: true, w: 1, strict: true },
	find: {}
};

function convertObjectId(conditions) {
	if (conditions._id) {
		try {
			conditions._id = new mongo.ObjectID(conditions._id)
		} catch (er) {}
	}
}

const Mongo = Interface.extend({
	open({name, host, port}, next) {
		// setup the mongo connection
		this.connection = new mongo.Db(
			name, 
			new mongo.Server(host || HOST, port || PORT), 
			mongo_options.open
		);

		this.connection.open(next);
	},

	createTable(table, fields, next) {
		const self = this;
		this.connection.createCollection(table, mongo_options.open, () => {
			// create unique indexes
			for (const key in fields) {
				const rule = fields[key];
				if (rule.unique) {
					const ufields = {};
					ufields[key] = 1;
					self.createIndex(table, ufields, {unique: true});
				}
			}

			// ignore any error for now
			next();
		})
	},

	createIndex(table, fields, config, next) {
		const f = ff(this, function () {
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, collection => {
			collection.ensureIndex(fields, config, f.slot());
		}).cb(next);
	},

	read(table, conditions, options, references, next) {
		if (conditions._id) {
			conditions._id = new mongo.ObjectID(conditions._id)
		}

		if (options['search']) {
			return this.search(table, options['search'], next);
		}

		if (options['in']) {
			const inOpts = options['in'];
			const key = Object.keys(inOpts)[0];

			if (key == '_id') { // TODO: include keys with rule.type == id
				for (let i = 0; i < inOpts[key].length; ++i) {
					try {
						inOpts[key][i] = mongo.ObjectID(inOpts[key][i])
					} catch (e) {}
				}
			}

			conditions[key] = {'$in': inOpts[key]};
			options = {};
		}

		const f = ff(this, function () {
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, collection => {
			// plain aggregation stack
			const stack = [
				{
					'$match': conditions
				}
			];

			// handle references if we have any
			for(const reference in references) {
				stack.push({
					'$lookup': references[reference]
				});
			}

			// do it
			collection.aggregate(stack, options, f.slot());
		}).cb(next);
	},

	write(table, conditions, data, next) {
		for (const i in conditions['references']) {
			const reference = conditions['references'][i];
			if(data[reference])
				data[reference] = new mongo.ObjectID(data[reference]);
		}

		delete conditions['references'];

		const f = ff(this, function () {
			console.log("BAH", data)
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, collection => {
			console.log("WRITE", data)
			collection.insert(data, mongo_options.insert, f.slot());
		}).cb(next);
	},

	modify(table, conditions, data, next) {
		convertObjectId(conditions);

		for (const i in conditions['references']) {
			const reference = conditions['references'][i];
			if(data[reference])
				data[reference] = new mongo.ObjectID(data[reference]);
		}

		delete conditions['references'];

		console.log("GOING IN", data);

		const f = ff(this, function () {
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, collection => {
			console.log("MODIFY", conditions, data)
			collection.update(conditions, {"$set": data}, mongo_options.update, f.slot());
		}).cb(next);
	},

	remove(table, conditions, next) {
		convertObjectId(conditions);

		const f = ff(this, function () {
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, collection => {
			collection.remove(conditions, mongo_options.remove, f.slot());
		}).cb(next);
	},

	increment(table, conditions, data, next) {
		convertObjectId(conditions);

		const f = ff(this, function () {
			this.connection.collection(table, mongo_options.collection, f.slot());	
		}, collection => {
			console.log(conditions, {"$inc": data})
			collection.update(conditions, {"$inc": data}, mongo_options.modify, f.slot());
		}).cb(next);
	}
});

module.exports = Mongo;