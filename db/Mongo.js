/**
 * MongoDB driver
 */


/* Dependencies */
const { MongoClient, ObjectID } = require("mongodb");
const Interface = require("./Interface");
const Cluster = require("../lib/Cluster");

/* Default values */
const HOST = "localhost";
const PORT = 27017;

/* Default options for each type of operation */
const mongo_options = {
	open: { w: 1, strict: false, safe: true },
	collection: { strict: false },
	insert: { w: 1, strict: false },
	update: { upsert: false, multi: true, w: 1, strict: false },
	find: {}
};

/**
 * Convert all "_id" fields with a string representation of an object ID
 * to the appropriate MongoDB object ID object
 * 
 * @param {object} conditions Search query object
 */
function convertObjectId(conditions) {
	if (conditions._id) {
		try {
			conditions._id = new ObjectID(conditions._id)
		} catch (er) {}
	}
}

const Mongo = Interface.extend({

	client: null,
	database: null,

	async connect({name, host, port}) {
		/* Setup the mongo connection */
		this.client = new MongoClient(`mongodb://${host || HOST}:${port || PORT}?useUnifiedTopology=true`);
		this.database = name;

		this.open();

		return true;
	},

	async open() {
		this.connection = await this.client.connect();
		await this.client.db(this.database);
	},

	async close() {
		this.client.close();
	},

	async createCollection(table, fields) {

		Cluster.console.log("CREATE COLLECTION", table, fields);
		this.open();

		const self = this;
		const collection = await this.database.createCollection(table, mongo_options.open, () => {
			// create unique indexes
			for (const key in fields) {
				const rule = fields[key];
				if (rule.unique) {
					const ufields = {};
					ufields[key] = 1;
					self.createIndex(table, ufields, {unique: true});
				}
			}
		});

		this.close();

		return collection;
	},

	async createIndex(table, fields, config) {

		Cluster.console.log("CREATE INDEX", table, fields, config);
		this.open();

		const collection = await this.database.collection(table, mongo_options.collection);
		const index = collection.createIndex(fields, config);

		this.close();

		return index;
	},

	async read(table, conditions, options, references) {

		Cluster.console.log("READ", table, conditions);
		this.open();

		if (conditions._id) {
			conditions._id = new mongo.ObjectID(conditions._id)
		}

		if (options['search']) {
			return this.search(table, options['search']);
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

		const collection = await this.database.collection(table, mongo_options.collection);

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
		const result = await collection.aggregate(stack, options);

		this.close

		return result;
	},

	async write(table, conditions, data) {

		Cluster.console.log("WRITE", table, conditions, data);
		this.open();

		for (const i in conditions['references']) {
			const reference = conditions['references'][i];
			if(data[reference])
				data[reference] = new mongo.ObjectID(data[reference]);
		}

		delete conditions['references'];

		const collection = await this.database.collection(table, mongo_options.collection);	
		const result = await collection.insert(data, mongo_options.insert);

		this.close();

		return result;
	},

	async modify(table, conditions, data) {

		Cluster.console.log("MODIFY", table, conditions, data);
		this.open();

		convertObjectId(conditions);

		for (const i in conditions['references']) {
			const reference = conditions['references'][i];
			if(data[reference])
				data[reference] = new mongo.ObjectID(data[reference]);
		}

		delete conditions['references'];

		const collection = await this.database.collection(table, mongo_options.collection);	
		const result = await collection.update(conditions, {"$set": data}, mongo_options.update);

		this.close();

		return result;
	},

	async remove(table, conditions) {

		Cluster.console.log("REMOVE", table, conditions);
		this.open();

		convertObjectId(conditions);

		const collection = await this.database.collection(table, mongo_options.collection);
		const result = await collection.remove(conditions, mongo_options.remove);

		this.close();

		return result;
	}
});

module.exports = Mongo;