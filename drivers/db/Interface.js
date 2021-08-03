/**
 * Database Interface
 *
 * This is the blank slate for abstracting any database system for use
 * in Sapling.  A new database driver should implement the below methods
 * in whatever way makes sense for the particular database technology.
 */


/* Dependencies */
import SaplingError from '../../lib/SaplingError.js';


/**
 * The Interface class
 */
export default class Interface {
	/**
	 * The connection object that should be populated by the connect() method
	 */
	connection = null


	/**
	 * Establish a connection to the database server
	 *
	 * @param {object} config {name: Name of the database, host: Host IP, port: Port number}
	 */
	async connect(config) {
		throw new SaplingError('Method not implemented: connect');
	}


	/**
	 * Create a collection in the database where one doesn't yet exist
	 *
	 * @param {string} collection Name for the collection being created
	 * @param {array} fields Model object
	 */
	async createCollection(collection, fields) {
		throw new SaplingError('Method not implemented: createCollection');
	}


	/**
	 * Create an index for the specified fields
	 *
	 * @param {string} collection Name of the target collection
	 * @param {object} fields Object of indices to create.  Key is field name, value is index type, e.g. 'unique'
	 */
	async createIndex(collection, fields) {
		throw new SaplingError('Method not implemented: createIndex');
	}


	/**
	 * Find one or more records for the given conditions in the given collection
	 *
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} options Driver specific options for the operation
	 */
	async read(collection, conditions, options) {
		throw new SaplingError('Method not implemented: read');
	}


	/**
	 * Create one new records in the given collection
	 *
	 * @param {string} collection Name of the target collection
	 * @param {object} data Data for the collection
	 */
	async write(collection, data) {
		throw new SaplingError('Method not implemented: write');
	}


	/**
	 * Modify the given values in data in any and all records matching the given conditions
	 *
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} data New data for the matching record(s). Omitted values does not imply deletion.
	 */
	async modify(collection, conditions, data) {
		throw new SaplingError('Method not implemented: modify');
	}


	/**
	 * Delete any and all matching records for the given conditions
	 *
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 */
	async remove(collection, conditions) {
		throw new SaplingError('Method not implemented: remove');
	}
};
