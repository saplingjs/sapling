/**
 * Nunjucks driver
 */


/* Dependencies */
const path = require("path");
const nunjucks = require("nunjucks");
const Interface = require("./Interface");
const { console } = require("../lib/Cluster");


module.exports = class Nunjucks extends Interface {

	/**
	 * Initialise Nunjucks
	 */
	constructor(App) {
		super();

		this.app = App;

		/* TODO: path below is fragile */
		nunjucks.configure(path.resolve(__dirname, '../', this.app.config.views), { autoescape: true });
	}


	/**
	 * Render a template file
	 * 
	 * @param {string} template Path of the template file being rendered, relative to views/
	 * @param {object} data Object of data to pass to the template
	 */
	async render(template, data) {
		console.log("RENDERING", template, data);
		
		return nunjucks.render(template, data);
	}


	/**
	 * Register custom tags with the template engine
	 * 
	 * @param {object} hooks Object of functions
	 */
	async registerHooks(hooks) {
		throw new Error("Method not implemented: registerHooks")
	}
};