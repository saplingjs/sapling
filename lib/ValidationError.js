/**
 * ValidationError
 *
 * Handle data validation errors
 */

import SaplingError from './SaplingError.js';


/**
 * The ValidationError class
 */
export default class ValidationError extends SaplingError {
	/**
	 * Initialise the ValidationError class
	 *
	 * @param {any} error The error(s) to be displayed
	 */
	constructor(error, ...parameters) {
		super(error, ...parameters);

		this.name = 'ValidationError';
	}
}
