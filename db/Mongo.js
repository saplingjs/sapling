/**
 * MongoDB driver
 */


/* Dependencies */
const { MongoClient, ObjectID } = require("mongodb");
const Interface = require("./Interface");
const { console } = require("../lib/Cluster");

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

module.exports = class Mongo extends Interface {

	/**
	 * The MongoClient instance
	 */
	client = null

	/**
	 * The selected database instance
	 */
	database = null

	/**
	 * Name of the database to be selected
	 */
	databaseName = null


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
	}


	/**
	 * Establish a connection to the database server
	 * 
	 * @param {object} config {name: Name of the database, host: Host IP, port: Port number}
	 */
	async connect({name, host, port}) {
		/* Setup the Mongo connection */
		this.client = new MongoClient(`mongodb://${host || HOST}:${port || PORT}?useUnifiedTopology=true`);

		/* Set the given database (actually select it in open()) */
		this.databaseName = name;
		await this.open();

		return true;
	}


	/**
	 * Open a connection and select the database
	 */
	async open() {
		this.connection = await this.client.connect();
		this.database = await this.client.db(this.databaseName);
	}


	/**
	 * Close a connection
	 */
	async close() {
		return await this.client.close();
	}


	/**
	 * Create a collection in the database where one doesn't yet exist
	 * 
	 * @param {string} name Name for the collection being created
	 * @param {array} fields Model object
	 */
	async createCollection(name, fields) {

		console.log("CREATE COLLECTION", name, fields);
		await this.open();

		const self = this;

		const collection = await this.database.createCollection(name, mongo_options.open, () => {
			/* Go through all the fields in the model */
			for (const key in fields) {
				const rule = fields[key];

				/* Create indices for any fields marked unique */
				if (rule.unique) {
					const ufields = {};
					ufields[key] = 1;
					self.createIndex(name, ufields, {unique: true});
				}
			}
		});

		await this.close();

		return collection;
	}


	/**
	 * Create an index for the specified fields
	 * 
	 * @param {string} name Name of the target collection
	 * @param {object} fields List of field names that should have indexes created. Key is the field name, value is the type of index
	 * @param {object} config Driver specific options for the operation
	 */
	async createIndex(name, fields, config) {

		console.log("CREATE INDEX", name, fields, config);
		await this.open();

		/* Select the given collection */
		const collection = await this.database.collection(name, mongo_options.collection);

		/* Create an index for the given field(s) */
		const index = collection.createIndex(fields, config);

		await this.close();

		return index;
	}


	/**
	 * Find one or more records for the given conditions in the given collection
	 * 
	 * @param {string} name Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} options Driver specific options for the operation
	 */
	async read(name, conditions, options, references) {

		console.log("READ", name, conditions);
		await this.open();

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
		const collection = await this.database.collection(name, mongo_options.collection);

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

		await this.close();

		return result;
	}


	/**
	 * Create one new records in the given collection
	 * 
	 * @param {string} name Name of the target collection
	 * @param {object} data Data for the collection
	 */
	async write(name, conditions, data) {

		console.log("WRITE", name, conditions, data);
		await this.open();

		/* For any reference constraints, create a proper object ID object */
		for (const i in conditions['references']) {
			const reference = conditions['references'][i];
			if(data[reference])
				data[reference] = new mongo.ObjectID(data[reference]);
		}

		/* Remove the raw references */
		delete conditions['references'];

		/* Select the given collection */
		const collection = await this.database.collection(name, mongo_options.collection);

		/* Create a new record with the data */
		const result = await collection.insert(data, mongo_options.insert);

		await this.close();

		return result;
	}


	/**
	 * Modify the given values in data in any and all records matching the given conditions
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} data New data for the matching record(s). Omitted values does not imply deletion.
	 */
	async modify(name, conditions, data) {

		console.log("MODIFY", name, conditions, data);
		await this.open();

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
		const collection = await this.database.collection(name, mongo_options.collection);	

		/* Update the given record with new data */
		const result = await collection.update(conditions, {"$set": data}, mongo_options.update);

		await this.close();

		return result;
	}


	/**
	 * Delete any and all matching records for the given conditions
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 */
	async remove(name, conditions) {

		console.log("REMOVE", name, conditions);
		await this.open();

		/* If there is an _id field in constraints, create a proper object ID object */
		conditions = this.convertObjectId(conditions);

		/* Select the given collection */
		const collection = await this.database.collection(name, mongo_options.collection);

		/* Delete the given records */
		const result = await collection.remove(conditions, mongo_options.remove);

		await this.close();

		return result;
	}
};
