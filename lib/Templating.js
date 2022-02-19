/**
 * Templating
 *
 * Middleware between the app and the database driver to do all
 * the higher level heavy lifting with data.
 */

/* Dependencies */
import path from 'node:path';
import _ from 'underscore';

import SaplingError from './SaplingError.js';


/**
 * The Templating class
 */
export default class Templating {
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
	}


	/**
	 * Import render driver if needed; no-op if already loaded.
	 */
	async importDriver() {
		if (this.renderer === null) {
			/* Set up the the desired driver */
			const driver = String(this.app.config.render.driver).toLowerCase();

			if (driver === 'html') {
				const { default: Html } = await import('../drivers/render/Html.js');
				this.renderer = new Html(this.app, this.viewsPath);
			} else {
				try {
					const { default: Driver } = await import(`@sapling/render-driver-${driver}`);
					this.renderer = new Driver(this.app, this.viewsPath);
				} catch {
					try {
						const { default: Custom } = await import(driver);
						this.renderer = new Custom(this.app, this.viewsPath);
					} catch {
						throw new SaplingError(`Cannot find any render driver for '${driver}'`);
					}
				}
			}
		}

		return this.renderer;
	}


	/**
	 * Render a given view and send it to the browser.
	 *
	 * @param {string} view The name of the view being rendered
	 * @param {object} data Query data
	 * @param {object} request Express request object
	 */
	async renderView(view, data, request) {
		await this.importDriver();

		/* Build the data to pass into template */
		if (request) {
			_.extend(data, {
				params: _.extend({}, request.params),
				query: request.query,
				headers: request.headers,
				session: request.session,
				form: request.body,
				$_POST: request.body, // Php-like alias
				$_GET: request.query,
				self: {
					dir: this.viewsPath,
					url: request.url,
					method: request.method,
					name: this.app.name,
				},
			});
		}

		/* Add CSRF token if needed */
		if (this.app.config.csrf || this.app.config.strict) {
			_.extend(data, {
				csrfToken: request.csrfToken(),
			});
		}

		/* Create new template engine instance */
		return await this.renderer.render(`${view}.${this.app.config.extension}`, data);
	}
}
