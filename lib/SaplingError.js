/**
 * SaplingError
 * 
 * Uniform error handling
 */


/**
 * The SaplingError class
 */
module.exports = class SaplingError extends Error {

	/**
	 * Initialise the SaplingError class
	 * 
	 * @param {any} err The error(s) to be displayed
	 */
	constructor(err, ...params) {
		super(err, ...params);

		/* Maintains proper stack trace for where our error was thrown */
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, SaplingError);
		}

		/* Create empty error structure */
		this.json = {"errors":[]};

		/* Parse the incoming error information */
		this.parse(err);
	}


	/**
	 * Parse the error into a uniform format
	 * 
	 * @param {any} err Error message, either a string or an object, or an array of either
	 */
	parse(err) {
		if (typeof err === "string") {
			/* If the error is a string, simply use it as a title for an otherwise empty error */
			/* TODO: Add some auto-generated metadata */
			this.json.errors.push({
				title: err
			});
		} else if (Array.isArray(err)) {
			/* If it's an array, assume multiple errors and parse each separately */
			for (let i = 0; i < err.length; ++i) {
				this.parse(err[i]);
			}
		} else if (typeof err === "object") {
			/* If it's an object, assume it's a fully qualified error already */
			/* TODO: add some validation for format */
			this.json.errors.push(err);
		}
	}
};
