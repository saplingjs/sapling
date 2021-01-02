/**
 * Parse method-route key
 */

'use strict';


/* Dependencies */
const SaplingError = require('../lib/SaplingError');


/**
 * Parse a string with a method and route into their
 * constituent parts.
 *
 * @param {string} key
 */
module.exports = function (key) {
	const object = {
		method: false,
		route: false
	};

	/* Format expected: "GET /url/here" */
	const parts = key.split(' ');

	/* Behave differently based on the number of segments */
	switch (parts.length) {
		case 1:
			/* Default to get */
			object.method = 'get';
			/* Assume the only part is the URL */
			object.route = parts[0];
			break;

		case 2:
			/* First part is the method: get, post, delete */
			object.method = parts[0].toLowerCase();
			/* Second part is the URL */
			object.route = parts[1];
			break;

		default:
			break;
	}

	/* Send an error if the method isn't an acceptable method */
	if (!['get', 'post', 'delete'].includes(object.method)) {
		console.error(new SaplingError(`Problem parsing '${key}': ${object.method} is not a valid method`));
	}

	return object;
};
