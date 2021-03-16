/**
 * In-memory "database" driver for Sapling
 *
 * A simple fallback database driver that just keeps everything in an
 * object in app memory, and gets wiped when the server dies.
 */

'use strict';


/* Dependencies */
const _ = require('underscore');
const Interface = require('./Interface');
const Utils = require('../../lib/Utils');


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
	 */
	async createCollection(collection) {
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
		let records = new Utils().deepClone(this.memory[collection] || []);

		/* If there are any conditions */
		if (Object.keys(conditions).length > 0) {
			records = records.filter(record => {
				return this.isMatch(record, conditions);
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
		if (!this.memory[collection]) {
			this.memory[collection] = [];
		}

		data._id = new Utils().randString();

		this.memory[collection].push(data);

		return new Utils().deepClone([data]);
	}


	/**
	 * Modify the given values in data in any and all records matching the given conditions
	 *
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} data New data for the matching record(s). Omitted values does not imply deletion.
	 */
	async modify(collection, conditions, data) {
		const records = this.memory[collection] || [];
		const newRecords = [];

		if (Object.keys(conditions).length > 0) {
			for (const [index, record] of records.entries()) {
				if (this.isMatch(record, conditions) && this.memory[collection]) {
					this.memory[collection][index] = _.extend(this.memory[collection][index], data);
					newRecords.push(this.memory[collection][index]);
				}
			}
		}

		return new Utils().deepClone(newRecords);
	}


	/**
	 * Delete any and all matching records for the given conditions
	 *
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 */
	async remove(collection, conditions) {
		const records = this.memory[collection] || [];

		if (Object.keys(conditions).length > 0) {
			for (const [index, record] of records.entries()) {
				if (this.isMatch(record, conditions) && this.memory[collection]) {
					this.memory[collection].splice(index, 1);
				}
			}
		} else {
			this.memory[collection] = [];
		}

		return [{ success: true }];
	}


	/**
	 * Check if a given record is a match for the given conditions
	 *
	 * @param {object} record Record from the data store
	 * @param {object} conditions Filter conditions object
	 */
	isMatch(record, conditions) {
		let match = false;

		/* Loop over all the conditions */
		for (const field of Object.keys(conditions)) {
			/* If the record doesn't contain the given field, move on */
			if (!(field in record)) {
				continue;
			}

			let condition = conditions[field];

			/* Coerce into an array */
			if (Array.isArray(condition) === false) {
				condition = [condition];
			}

			match = condition.some(value => {
				/* If it's an ID, do an exact match always */
				if (field === '_id' && record[field] === value) {
					return true;
				}

				/* If we have wildcards, build a regex */
				if (String(value).includes('*')) {
					return String(record[field]).match(new RegExp(`^${value.split('*').join('(.*)')}$`, 'gmi')) !== null;
				}

				/* Otherwise do a direct match */
				return typeof record[field] === 'number' ? record[field] === value : record[field].includes(value);
			});
		}

		return match;
	}
};
