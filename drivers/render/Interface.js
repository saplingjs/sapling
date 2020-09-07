/**
 * Render Interface
 * 
 * This is the blank slate for abstracting any template rendering
 * system for use in Sapling.  A new render driver should implement
 * the below methods in whatever way makes sense for the particular
 * database technology.
 */

const Error = require("../../lib/Error");

class Interface {

	/**
	 * Load parent app
	 */
	constructor(App) {
		this.app = App;
	}


	/**
	 * Render a template file
	 * 
	 * @param {string} template Path of the template file being rendered, relative to views/
	 * @param {object} data Object of data to pass to the template
	 */
	async render(template, data) {
		throw new Error("Method not implemented: render")
	}


	/**
	 * Register custom tags with the template engine
	 * 
	 * @param {object} hooks Object of functions
	 */
	async registerHooks(hooks) {
		throw new Error("Method not implemented: registerHooks")
	}
}

module.exports = Interface;