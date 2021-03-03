/**
 * Utils
 *
 * General purpose utility functions
 */

'use strict';


/* Dependencies */
const fs = require('fs');

const SaplingError = require('./SaplingError');


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
};
