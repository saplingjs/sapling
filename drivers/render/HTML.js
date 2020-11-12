/**
 * HTML driver for Sapling
 * 
 * A simple fallback render driver that just loads the HTML files
 * its given.
 */


/* Dependencies */
const fs = require("fs");
const path = require("path");
const Interface = require("./Interface");
const { console } = require("../../lib/Cluster");


module.exports = class HTML extends Interface {

	/**
	 * Initialise HTML
	 */
	constructor(App) {
		super();
		this.app = App;
	}


	/**
	 * Render a template file
	 * 
	 * @param {string} template Path of the template file being rendered, relative to views/
	 * @param {object} data Object of data to pass to the template
	 */
	async render(template, data) {
		return fs.readFileSync(path.resolve(this.app.dir, this.app.config.views, template), "utf8");
	}


	/**
	 * Register custom tags with the template engine
	 * 
	 * @param {object} hooks Object of functions
	 */
	async registerHooks(hooks) {
		throw new Error("Method not supported: registerHooks")
	}
};