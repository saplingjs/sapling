/**
 * Utils
 *
 * General purpose utility functions
 */

'use strict';


/* Dependencies */
const fs = require('fs');

const SaplingError = require('./SaplingError.js');


/**
 * The Utils class
 */
module.exports = class Utils {
	/**
	 * Initialise the Utils class
	 *
	 * @param {object} App The App instance
	 */
	constructor(App) {
		this.app = App;
	}


	/**
	 * Generate a random string
	 */
	randString() {
		return (`00000000${Math.random().toString(36).slice(2)}`).slice(-11);
	}


	/**
	 * Get all files recursively from a given directory
	 *
	 * @param {string} dir Directory path
	 */
	getFiles(dir) {
		let results = [];
		let list;

		try {
			list = fs.readdirSync(dir);
		} catch {
			throw new SaplingError(`Cannot read directory: ${dir}`);
		}

		for (const file of list) {
			const dirfile = dir + '/' + file;
			const stat = fs.statSync(dirfile);
			if (stat && stat.isDirectory()) {
				/* Recurse into a subdirectory */
				results = results.concat(this.getFiles(dirfile));
			} else {
				/* Is a file */
				results.push(dirfile);
			}
		}

		return results;
	}


	/**
	 * Deep clone an object
	 *
	 * @param {object} obj Object to be cloned
	 */
	deepClone(object) {
		return JSON.parse(JSON.stringify(object));
	}


	/**
	 * Convert any input to a logical boolean value
	 *
	 * @param {any} value Value to be converted
	 * @returns Boolean
	 */
	trueBoolean(value) {
		switch (typeof value) {
			case 'boolean':
				return value;

			case 'string':
				if (value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' || value.toLowerCase() === 'on') {
					return true;
				}

				return false;

			case 'number':
			case 'bigint':
				return Boolean(value);

			case 'undefined':
				return undefined;

			case 'object':
				if (value === null) {
					return null;
				}

				if (Array.isArray(value) && value.length === 0) {
					return false;
				}

				return true;

			case 'function':
				return this.trueBoolean(value());

			default:
				return false;
		}
	}
};
