/**
 * Run hook
 */


/* Dependencies */
const SaplingError = require('../lib/SaplingError');


/**
 * Parse a string with a method and route into their
 * constituent parts.
 * 
 * @param {string} key 
 */
module.exports = function parseMethodRouteKey(key) {
	let obj = {
		method: false,
		route: false
	}

	/* Format expected: "GET /url/here" */
	const parts = key.split(" ");

	/* Behave differently based on the number of segments */
	switch(parts.length) {
		case 1:
			/* Default to get */
			obj.method = "get";
			/* Assume the only part is the URL */
			obj.route = parts[0];
			break;

		case 2:
			/* First part is the method: get, post, delete */
			obj.method = parts[0].toLowerCase();
			/* Second part is the URL */
			obj.route = parts[1];
			break;

		default:
			break;
	}

	/* Send an error if the method isn't an acceptable method */
	if(!["get", "post", "delete"].includes(obj.method)) {
		console.error(new SaplingError(`Problem parsing '${key}': ${obj.method} is not a valid method`));
	}

	return obj;
};
