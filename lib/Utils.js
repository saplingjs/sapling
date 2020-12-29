/**
 * Utils
 * 
 * General purpose utility functions
 */

'use strict';

const _ = require("underscore");
const fs = require("fs");

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
		return (`00000000${Math.random().toString(36).substr(2)}`).substr(-11);
	}


	/**
	 * Get all files recursively from a given directory
	 * 
	 * @param {string} dir Directory path
	 */
	getFiles(dir) {
		let results = [];
		const list = fs.readdirSync(dir);

		list.forEach(file => {
			const dirfile = dir + '/' + file;
			const stat = fs.statSync(dirfile);
			if (stat && stat.isDirectory()) { 
				/* Recurse into a subdirectory */
				results = results.concat(this.getFiles(dirfile));
			} else { 
				/* Is a file */
				results.push(dirfile);
			}
		});

		return results;
	}


	/**
	 * Deep clone an object
	 * 
	 * @param {object} obj Object to be cloned
	 */
	deepClone(obj) {
		return JSON.parse(JSON.stringify(obj));
	}
};
