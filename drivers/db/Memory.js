/**
 * In-memory "database" driver for Sapling
 * 
 * A simple fallback database driver that just keeps everything in an
 * object in app memory, and gets wiped when the server dies.
 */


/* Dependencies */
const _ = require("underscore");
const Interface = require("./Interface");
const Utils = require("../../lib/Utils");


/**
 * The Memory class
 */
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
		/* Fetch the collection, or provide an empty array if none exists */
		let records = JSON.parse(JSON.stringify(this.memory[collection])) || [];

		/* If there are any conditions */
		if(Object.keys(conditions).length > 0) {
			records = records.filter(record => {
				let match = false;
	
				/* Go through each condition, and set a match if it matches */
				Object.keys(conditions).forEach(field => {
					match = field in record && ((field !== '_id' && record[field].indexOf(conditions[field]) > -1) ||
						(field === '_id' && record[field] == conditions[field]));
				});
	
				return match;
			});
		}

		return records;
	}


	/**
	 * Create one new records in the given collection
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} data Data for the collection
	 */
	async write(collection, data) {
		if(!this.memory[collection])
			this.memory[collection] = [];

		data._id = new Utils().randString();

		this.memory[collection].push(data);

		return JSON.parse(JSON.stringify(data));
	}


	/**
	 * Modify the given values in data in any and all records matching the given conditions
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} data New data for the matching record(s). Omitted values does not imply deletion.
	 */
	async modify(collection, conditions, data) {
		let records = this.memory[collection] || [];
		let newRecords = [];

		if(Object.keys(conditions).length > 0) {
			records.forEach((record, index) => {
				let match = false;
	
				Object.keys(conditions).forEach(field => {
					match = (field !== '_id' && record[field].indexOf(conditions[field]) > -1) ||
						(field === '_id' && record[field] == conditions[field]);
				});
	
				if(match && this.memory[collection]) {
					this.memory[collection][index] = _.extend(this.memory[collection][index], data);
					newRecords.push(this.memory[collection][index]);
				}
			});
		}

		return JSON.parse(JSON.stringify(newRecords));
	}


	/**
	 * Delete any and all matching records for the given conditions
	 * 
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 */
	async remove(collection, conditions) {
		let records = this.memory[collection] || [];

		if(Object.keys(conditions).length > 0) {
			records.forEach((record, index) => {
				let match = false;
	
				Object.keys(conditions).forEach(field => {
					match = (field !== '_id' && record[field].indexOf(conditions[field]) > -1) ||
						(field === '_id' && record[field] == conditions[field]);
				});
	
				if(match && this.memory[collection]) {
					this.memory[collection].splice(index, 1);
				}
			});
		} else {
			this.memory[collection] = [];
		}

		return [{"success": true}];
	}
}
