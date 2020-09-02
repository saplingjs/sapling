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

const Mongo = Interface.extend({

	/**
	 * The MongoClient instance
	 */
	client: null,

	/**
	 * The selected database instance
	 */
	database: null,


	/**
	 * Convert all "_id" fields with a string representation of an object ID
	 * to the appropriate MongoDB object ID object
	 * 
	 * @param {object} conditions Search query object
	 */
	convertObjectId(conditions) {
		if (conditions._id) {
			try {
				conditions._id = new ObjectID(conditions._id);
			} catch (er) {}
		}
	
		return conditions;
	},


	/**
	 * Establish a connection to the database server
	 * 
	 * @param {object} config {name: Name of the database, host: Host IP, port: Port number}
	 */
	async connect({name, host, port}) {
		/* Setup the Mongo connection */
		this.client = new MongoClient(`mongodb://${host || HOST}:${port || PORT}?useUnifiedTopology=true`);

		/* Set the given database (actually select it in open()) */
		this.database = name;
		this.open();

		return true;
	},


	/**
	 * Open a connection and select the database
	 */
	async open() {
		this.connection = await this.client.connect();
		await this.client.db(this.database);
	},


	/**
	 * Close a connection
	 */
	async close() {
		this.client.close();
	},


	/**
	 * Create a collection in the database where one doesn't yet exist
	 * 
	 * @param {string} collection Name for the collection being created
	 * @param {array} fields Model object
	 */
	async createCollection(collection, fields) {

		Cluster.console.log("CREATE COLLECTION", collection, fields);
		this.open();

		const self = this;
		const collection = await this.database.createCollection(collection, mongo_options.open, () => {
			/* Go through all the fields in the model */
			for (const key in fields) {
				const rule = fields[key];

				/* Create indices for any fields marked unique */
				if (rule.unique) {
					const ufields = {};
					ufields[key] = 1;
					self.createIndex(collection, ufields, {unique: true});
				}
			}
		});

		this.close();

		return collection;
	},


	/**
	 * Create an index for the specified fields
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} fields List of field names that should have indexes created. Key is the field name, value is the type of index
	 * @param {object} config Driver specific options for the operation
	 */
	async createIndex(collection, fields, config) {

		Cluster.console.log("CREATE INDEX", collection, fields, config);
		this.open();

		/* Select the given collection */
		const collection = await this.database.collection(collection, mongo_options.collection);

		/* Create an index for the given field(s) */
		const index = collection.createIndex(fields, config);

		this.close();

		return index;
	},


	/**
	 * Find one or more records for the given conditions in the given collection
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} options Driver specific options for the operation
	 */
	async read(collection, conditions, options, references) {

		Cluster.console.log("READ", collection, conditions);
		this.open();

		/* If there is an _id field in constraints, create a proper object ID object */
		conditions = this.convertObjectId(conditions);

		/* TODO: find out what this is */
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

		/* Get the collection */
		const collection = await this.database.collection(collection, mongo_options.collection);

		/* Plain aggregation stack */
		const stack = [
			{
				'$match': conditions
			}
		];

		/* Handle reference fields if we have any */
		for(const reference in references) {
			stack.push({
				'$lookup': references[reference]
			});
		}

		/* Do it */
		const result = await collection.aggregate(stack, options);

		this.close();

		return result;
	},


	/**
	 * Create one new records in the given collection
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} data Data for the collection
	 */
	async write(collection, conditions, data) {

		Cluster.console.log("WRITE", collection, conditions, data);
		this.open();

		/* For any reference constraints, create a proper object ID object */
		for (const i in conditions['references']) {
			const reference = conditions['references'][i];
			if(data[reference])
				data[reference] = new mongo.ObjectID(data[reference]);
		}

		/* Remove the raw references */
		delete conditions['references'];

		/* Select the given collection */
		const collection = await this.database.collection(collection, mongo_options.collection);

		/* Create a new record with the data */
		const result = await collection.insert(data, mongo_options.insert);

		this.close();

		return result;
	},


	/**
	 * Modify the given values in data in any and all records matching the given conditions
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} data New data for the matching record(s). Omitted values does not imply deletion.
	 */
	async modify(collection, conditions, data) {

		Cluster.console.log("MODIFY", collection, conditions, data);
		this.open();

		/* If there is an _id field in constraints, create a proper object ID object */
		conditions = this.convertObjectId(conditions);

		/* For any reference constraints, create a proper object ID object */
		for (const i in conditions['references']) {
			const reference = conditions['references'][i];
			if(data[reference])
				data[reference] = new mongo.ObjectID(data[reference]);
		}

		/* Remove the raw references */
		delete conditions['references'];

		/* Select the given collection */
		const collection = await this.database.collection(collection, mongo_options.collection);	

		/* Update the given record with new data */
		const result = await collection.update(conditions, {"$set": data}, mongo_options.update);

		this.close();

		return result;
	},


	/**
	 * Delete any and all matching records for the given conditions
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 */
	async remove(collection, conditions) {

		Cluster.console.log("REMOVE", collection, conditions);
		this.open();

		/* If there is an _id field in constraints, create a proper object ID object */
		conditions = this.convertObjectId(conditions);

		/* Select the given collection */
		const collection = await this.database.collection(collection, mongo_options.collection);

		/* Delete the given records */
		const result = await collection.remove(conditions, mongo_options.remove);

		this.close();

		return result;
	}
});

module.exports = Mongo;