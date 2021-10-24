/**
 * SaplingError
 *
 * Uniform error handling
 */

/**
 * The SaplingError class
 */
export default class SaplingError extends Error {
	/**
	 * Initialise the SaplingError class
	 *
	 * @param {any} error The error(s) to be displayed
	 */
	constructor(error, ...parameters) {
		super(error, ...parameters);

		/* Maintains proper stack trace for where our error was thrown */
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, SaplingError);
		}

		this.name = 'SaplingError';

		/* Create empty error structure */
		this.json = { errors: [] };

		/* Parse the incoming error information */
		this.parse(error);
	}


	/**
	 * Parse the error into a uniform format
	 *
	 * @param {any} error Error message, either a string or an object, or an array of either
	 */
	parse(error) {
		if (typeof error === 'string') {
			/* If the error is a string, simply use it as a title for an otherwise empty error */
			this.json.errors.push({
				title: error,
			});
		} else if (Array.isArray(error)) {
			/* If it's an array, assume multiple errors and parse each separately */
			for (const element of error) {
				this.parse(element);
			}
		} else {
			/* If it's anything else, assume it's a fully qualified error already */
			this.json.errors.push(error);
		}
	}
}
