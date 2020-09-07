/**
 * Templating
 * 
 * Middleware between the app and the database driver to do all
 * the higher level heavy lifting with data.
 */

const path = require("path");
const _ = require("underscore");


/**
 * The Templating class
 */
module.exports = class Templating {

	/**
	 * Render class
	 */
	renderer = null;


	/**
	 * Initialise the Templating class
	 */
	constructor(App) {
		this.app = App;

		/* Set up the the desired driver */
		this.renderer = new (require(`../render/${this.app.config.render.type}`))(App);
	}


	/**
	 * Render a given view and send it to the browser.
	 * 
	 * @param {string} view The name of the view being rendered
	 * @param {object} data Query data
	 * @param {object} req Express req object
	 * @param {object} res Express res object
	 * @param {function} next Chain callback
	 */
	async renderView(view, data, req, res, next) {
		const body = Object.keys(req.body).length ? req.body : null;

		/* Build the data to pass into template */
		_.extend(data, {
			params: _.extend({}, req.params), 
			query: req.query,
			headers: req.headers,
			session: req.session,
			form: body,
			"$_POST": body, // php-like alias
			"$_GET": req.query,
			self: {
				dir: path.join(this.app.dir, this.app.config.views),
				url: req.url,
				method: req.method,
				name: this.app.name
			}
		});

		if (this.app.opts.etc) {
			data.self.etc = this.app.opts.etc;
		}

		/* Create new template engine instance */
		const template = await this.renderer.render(`${view}.${this.app.config.extension}`, data);
		res.send(template);

		if(next) next();
	}

};