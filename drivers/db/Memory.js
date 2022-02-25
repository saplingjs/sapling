/**
 * In-memory "database" driver for Sapling
 *
 * A simple fallback database driver that just keeps everything in an
 * object in app memory, and gets wiped when the server dies.
 */

/* Dependencies */
import _ from 'underscore';

import SaplingError from '../../lib/SaplingError.js';
import Utils from '../../lib/Utils.js';
import Interface from './Interface.js';


/**
 * The Memory class
 */
export default class Memory extends Interface {
	/**
	 * The object that contains everything
	 */
	memory = {};
	uniques = {};


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
	createIndex(collection, fields) {
		if (!(collection in this.uniques)) {
			this.uniques[collection] = [];
		}

		this.uniques[collection] = this.uniques[collection].concat(Object.keys(fields));
	}


	/**
	 * Find one or more records for the given conditions in the given collection
	 *
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} options Options for the operation
	 */
	async read(collection, conditions, options) {
		/* Fetch the collection, or provide an empty array if none exists */
		let records = new Utils().deepClone(this.memory[collection] || []);

		/* If there are any conditions */
		if (Object.keys(conditions).length > 0) {
			records = records.filter(record => this.isMatch(record, conditions));
		}

		/* Limit and skip, if defined */
		if (options && 'limit' in options) {
			const skip = options.skip || 0;
			records = records.slice(skip, options.limit + skip);
		}

		/* Sort, if defined */
		if (options && 'sort' in options) {
			records = records.sort((a, b) => {
				let i = 0;
				let result = 0;

				/* Go through all sorted properties */
				while (result === 0 && i < options.sort.length) {
					const property = options.sort[i][0];

					/* If property isn't available in record, forget about it */
					if (!(property in a) || !(property in b)) {
						continue;
					}

					/* Sort by property, in the direction requested */
					result = (a[property] < b[property]) ? -1 : ((a[property] > b[property]) ? 1 : 0);
					result *= options.sort[i][1];
					i++;
				}

				return result;
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
		/* Create collection if it doesn't exist */
		if (!this.memory[collection]) {
			this.memory[collection] = [];
		}

		/* Check for uniques */
		const uniques = this.checkUnique(collection, data);
		if (uniques) {
			throw new SaplingError(`Value of ${uniques} must be unique`);
		}

		/* Generate random ID */
		data._id = new Utils().randString();

		/* Add to memory */
		this.memory[collection].push(data);

		/* Return to request */
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
					/* Check for uniques */
					const uniques = this.checkUnique(collection, data, this.memory[collection][index]._id);
					if (uniques) {
						throw new SaplingError(`Value of ${uniques} must be unique`);
					}

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
		let count = 0;

		if (Object.keys(conditions).length > 0) {
			for (const [index, record] of records.entries()) {
				if (this.isMatch(record, conditions) && this.memory[collection]) {
					this.memory[collection].splice(index, 1);
					count++;
				}
			}
		} else {
			count = collection in this.memory ? this.memory[collection].length : 0;
			this.memory[collection] = [];
		}

		return { data: true, count };
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

			const condition = new Utils().coerceArray(conditions[field]);

			match = condition.some(value => {
				/* If it's an ID, do an exact match always */
				if (field === '_id' && record[field] === value) {
					return true;
				}

				/* If we have wildcards, build a regex */
				if (String(value).includes('*')) {
					return new Utils().matchWildcard(record[field], value);
				}

				/* Otherwise do a direct match */
				return typeof record[field] === 'number' ? record[field] === value : record[field].includes(value);
			});
		}

		return match;
	}


	/**
	 * Check if a value for a field with a unique index already exists in memory
	 *
	 * @param {string} collection Name of the collection
	 * @param {object} data Data that will be entered
	 * @param {string} id Optional ID of the current object, to ignore the record being modified
	 * @returns array of field names with matching values, false if no matches
	 */
	checkUnique(collection, data, id) {
		const matches = [];

		if (collection in this.uniques && Object.keys(data).some(r => this.uniques[collection].includes(r))) {
			for (const field of this.uniques[collection]) {
				if (this.memory[collection].some(item => item[field] === data[field] && (id ? item._id !== id : true))) {
					matches.push(field);
				}
			}
		}

		return matches.length > 0 ? matches : false;
	}
}
