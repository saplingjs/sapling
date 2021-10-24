/**
 * Render Interface
 *
 * This is the blank slate for abstracting any template rendering
 * system for use in Sapling.  A new render driver should implement
 * the below methods in whatever way makes sense for the particular
 * database technology.
 */


/* Dependencies */
import SaplingError from '../../lib/SaplingError.js';


/**
 * The Interface class
 */
export default class Interface {
	/**
	 * Load parent app
	 */
	constructor(App, viewsPath) {
		this.app = App;
		this.viewsPath = viewsPath;
	}


	/**
	 * Render a template file
	 *
	 * @param {string} template Path of the template file being rendered, relative to root
	 * @param {object} data Object of data to pass to the template
	 */
	async render(template, data) {
		throw new SaplingError('Method not implemented: render');
	}


	/**
	 * Register custom tags with the template engine
	 *
	 * @param {object} tags Object of functions
	 */
	async registerTags(tags) {
		/**
		 * Tags.get
		 *
		 * Set a template variable with data from a given
		 * data API URL.  The driver implementation must
		 * handle assigning the return value to a template
		 * variable.
		 *
		 * @param {string} url Data API URL
		 * @param {string} role Optional user role, defaults to current user role
		 */

		throw new SaplingError('Method not implemented: registerTags');
	}
}
