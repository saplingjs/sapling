/**
 * Templating
 * 
 * Middleware between the app and the database driver to do all
 * the higher level heavy lifting with data.
 */


/* Dependencies */
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
	 * 
	 * @param {object} App The App instance
	 * @param {any} viewsPath Path to the directory for views
	 */
	constructor(App, viewsPath) {
		this.app = App;

		/* Infer base path if not supplied */
		this.viewsPath = viewsPath ? viewsPath : path.join(this.app.dir, this.app.config.viewsDir);

		/* Set up the the desired driver */
		const driver = String(this.app.config.render.driver).toLowerCase();

		if(driver == 'html') {
			this.renderer = new (require('../drivers/render/Html'))(App, this.viewsPath);
		} else {
			this.renderer = new (require(`@sapling/render-driver-${driver}`))(App, this.viewsPath);
		}
	}


	/**
	 * Render a given view and send it to the browser.
	 * 
	 * @param {string} view The name of the view being rendered
	 * @param {object} data Query data
	 * @param {object} request Express request object
	 * @param {object} response Express response object
	 */
	async renderView(view, data, request, response) {
		const body = Object.keys(request.body).length ? request.body : null;

		/* Build the data to pass into template */
		_.extend(data, {
			params: _.extend({}, request.params), 
			query: request.query,
			headers: request.headers,
			session: request.session,
			form: body,
			"$_POST": body, // php-like alias
			"$_GET": request.query,
			self: {
				dir: this.viewsPath,
				url: request.url,
				method: request.method,
				name: this.app.name
			}
		});

		if (this.app.opts.etc) {
			data.self.etc = this.app.opts.etc;
		}

		/* Create new template engine instance */
		return await this.renderer.render(`${view}.${this.app.config.extension}`, data);
	}

};