/**
 * Utils
 *
 * General purpose utility functions
 */

/* Dependencies */
import fs from 'node:fs';

import SaplingError from './SaplingError.js';


/**
 * The Utils class
 */
export default class Utils {
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
	async getFiles(dir) {
		let results = [];
		let list;

		try {
			list = await fs.promises.readdir(dir);
		} catch {
			throw new SaplingError(`Cannot read directory: ${dir}`);
		}

		for (const file of list) {
			const dirfile = dir + '/' + file;
			const stat = await fs.promises.stat(dirfile);
			if (stat && stat.isDirectory()) {
				/* Recurse into a subdirectory */
				results = results.concat(await this.getFiles(dirfile));
			} else {
				/* Is a file */
				results.push(dirfile);
			}
		}

		return results;
	}


	/**
	 * Check if a file or directory exists
	 *
	 * @param {string} file Path to file or directory
	 * @returns Boolean
	 */
	async exists(file) {
		try {
			await fs.promises.access(file, fs.constants.F_OK);
			return true;
		} catch {
			return false;
		}
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


	/**
	 * Test a string against a rule that has asterisk wildcards
	 *
	 * @param {string} string String to be tested
	 * @param {string} rule Pattern to be tested against
	 * @returns {boolean} Whether or not the string matches the pattern
	 */
	matchWildcard(string, rule) {
		const escapeRegex = string => string.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1');
		return new RegExp(`^${String(rule).split('*').map(element => escapeRegex(element)).join('.*')}$`, 'i').test(String(string));
	}


	/**
	 * Make sure the value passed is an array
	 *
	 * @param {any} array Value to be coerced
	 * @returns {array} Array
	 */
	coerceArray(array) {
		return Array.isArray(array) ? array : [array];
	}
}
