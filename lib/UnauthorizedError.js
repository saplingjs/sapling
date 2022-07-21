/**
 * SaplingError
 *
 * Uniform error handling
 */

import SaplingError from './SaplingError.js';


/**
 * The UnauthorizedError class
 */
export default class UnauthorizedError extends SaplingError {
	/**
	 * Initialise the UnauthorizedError class
	 */
	constructor(...parameters) {
		super(...parameters);

		this.name = 'UnauthorizedError';

		/* Create empty error structure */
		this.json = {
			errors: [
				{
					title: 'Unauthorized',
				},
			],
		};
	}
}
