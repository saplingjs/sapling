/**
 * In-memory "database" driver for Sapling
 * 
 * A simple fallback database driver that just keeps everything in an
 * object in app memory, and gets wiped when the server dies.
 */


const SaplingError = require("../../lib/SaplingError");
const Interface = require("./Interface");

module.exports = class Memory extends Interface {

	/**
	 * The object that contains everything
	 */
	memory = {}


	/**
	 * Establish a connection to the database server
	 */
	connect() {
		return true;
	}


	/**
	 * Create a collection in the database where one doesn't yet exist
	 * 
	 * @param {string} collection Name for the collection being created
	 * @param {array} fields Model object
	 */
	async createCollection(collection, fields) {
		this.memory[collection] = [];
	}


	/**
	 * Create an index for the specified fields
	 */
	createIndex() {
		return true;
	}


	/**
	 * Find one or more records for the given conditions in the given collection
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 */
	async read(collection, conditions) {
		const coll = this.memory[collection];
		const data = [];

		return new Promise(resolve => {
			resolve(data);
		});
	}


	/**
	 * Create one new records in the given collection
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} data Data for the collection
	 */
	async write(collection, data) {
		this.memory[collection].push(data);
		return data;
	}


	/**
	 * Modify the given values in data in any and all records matching the given conditions
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} data New data for the matching record(s). Omitted values does not imply deletion.
	 */
	async modify(collection, conditions, data) {
		throw new SaplingError("Method not implemented: modify")
	}


	/**
	 * Delete any and all matching records for the given conditions
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 */
	async remove(collection, conditions) {
		throw new SaplingError("Method not implemented: remove")
	}
}
