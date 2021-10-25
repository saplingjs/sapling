/**
 * Redirect
 *
 * Figures out if the current request needs to be redirected,
 * and does so if needed.  Otherwise returns false.
 */

/* Dependencies */
import { inject } from 'regexparam';


/**
 * The Redirect class
 */
export default class Redirect {
	/**
	 * Initialise the Redirect class
	 *
	 * @param {object} App The App instance
	 * @param {object} request Request object from Express
	 * @param {object} response Response object from Express
	 * @param {object} data Data to apply to redirect destination
	 */
	constructor(App, request, response, data) {
		this.app = App;
		this.request = request;
		this.response = response;

		this.data = Array.isArray(data) ? data[0] : data;
	}


	/**
	 * Execute the redirection
	 *
	 * @returns {boolean} Whether redirection happened or not
	 */
	do() {
		if ('redirect' in this.request.query || 'goto' in this.request.query) {
			const destination = String(this.request.query.redirect || this.request.query.goto);
			this.response.redirect(inject(destination, this.data));
			return true;
		}

		return false;
	}
}
