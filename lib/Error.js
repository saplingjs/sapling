/**
 * Error
 * 
 * Uniform error handling
 */

class Error {
	constructor(err) {
		/* Create empty error structure */
		this.template = {"errors":[]};

		/* Parse the incoming error information */
		this.parse(err);
	}


	/**
	 * Parse the error into a uniform format
	 * 
	 * @param {any} err Error, either a string or an object, or an array of either
	 */
	parse(err) {
		if (typeof err === "string") {
			/* If the error is a string, simply use it as a title for an otherwise empty error */
			/* TODO: Add some auto-generated metadata */
			this.template.errors.push({
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
			this.template.errors.push(err);
		}
	}


	/**
	 * Convert the initialised error to a JSON string
	 */
	toJSON() {
		return JSON.stringify(this.template);
	}
}

module.exports = Error;