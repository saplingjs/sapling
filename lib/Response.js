/**
 * Response
 *
 * Parses, formats and sends a response to the end user.  Create a
 * singular instance of this each time a response must be sent.
 */

/* Dependencies */
import path from 'node:path';
import isobject from 'isobject';

import { console } from './Cluster.js';
import Redirect from './Redirect.js';
import Templating from './Templating.js';
import Utils from './Utils.js';


/**
 * The Response class
 */
export default class Response {
	/**
	 * Initialise the Response class
	 *
	 * @param {object} App The App instance
	 * @param {object} request Request object from Express
	 * @param {object} response Response object from Express
	 * @param {SaplingError} error SaplingError object
	 * @param {any} content Stuff that needs to be sent to the frontend
	 */
	constructor(App, request, response, error, content) {
		this.app = App;
		this.request = request;
		this.response = response;
		this.error = error;
		this.content = content;

		/* Try to detect if this is an AJAX request */
		if (this.request) {
			this.ajax = request.xhr || (request.headers && request.headers.accept && request.headers.accept.includes('json'));
		}

		/* Respond based on the given parameters */
		if (this.response) {
			if (this.error) {
				this.errorResponse();
			} else if (content === false) {
				this.notFoundResponse();
			} else if (typeof content === 'string') {
				this.viewResponse();
			} else if (typeof content === 'undefined') {
				this.genericResponse();
			} else {
				this.dataResponse();
			}
		}
	}


	/**
	 * Convert an array of objects into a string of HTML with tables
	 *
	 * @param {array} arr Array of objects
	 */
	convertArrayToTables(array) {
		let html = '';

		/* Coerce a boolean into an object array format */
		if (typeof array === 'boolean') {
			array = [{ 'Return value': array }];
		}

		/* Coerce anything else into an array */
		array = new Utils().coerceArray(array);

		/* Whether the array contains objects or something else */
		const notObject = array.length > 0 && !isobject(array[0]);

		/* Create a table for the array */
		if (notObject) {
			html += '<table><tbody>';
		}

		for (let item of array) {
			/* If it's an array or something */
			if (notObject) {
				/* Recurse if it's an array or object */
				if (Array.isArray(item) || isobject(item)) {
					item = this.convertArrayToTables(item);
				}

				html += `<tr><td>${item}</td></tr>`;
			} else {
				/* Create a table for each object in the array */
				html += '<table><tbody>';

				/* Create a row for each key in the object */
				for (const key of Object.keys(item)) {
					let value = item[key];

					/* Recurse if it's an array or object */
					if (Array.isArray(value) || isobject(value)) {
						value = this.convertArrayToTables(value);
					}

					html += `<tr><th>${key}</th><td>${value}</td></tr>`;
				}

				html += '</tbody></table>';
			}
		}

		if (notObject) {
			html += '</tbody></table>';
		}

		return html;
	}


	/**
	 * Return a string for number of records found/affected in an array.
	 *
	 * @param {any} response Response to be analysed
	 */
	getRecordsFound(response) {
		const count = (this.request.query.single || !('count' in response)) ? 1 : response.count;
		return count + (count === 1 ? ' record ' : ' records ') + (this.request.method === 'GET' ? 'found' : 'affected');
	}


	/**
	 * Load Templating class and the driver
	 */
	async initTemplating() {
		/* Create a Templating instance */
		this.templating = new Templating(this.app, path.join(this.app.dir, 'static/response'));

		/* Load the driver */
		return await this.templating.importDriver();
	}


	/**
	 * Respond with a pre-rendered view
	 */
	viewResponse() {
		try {
			this.content = JSON.parse(this.content);
			this.dataResponse();
		} catch {
			this.response.status(200).send(this.content);
		}
	}


	/**
	 * Respond with a generic success
	 */
	genericResponse() {
		this.content = { success: true };
		this.response.status(200).send(this.content);
	}


	/**
	* Respond with results from storage
	*/
	async dataResponse() {
		/* Check if redirect is needed */
		const redirect = (new Redirect(this, this.request, this.response, this.content)).do();
		if (redirect) {
			return false;
		}

		/* Otherwise just return the data */
		if (!this.ajax && !this.app.config.strict && !this.app.config.production) {
			/* Load templating driver */
			await this.initTemplating();

			/* As a view */
			this.response.send(await this.templating.renderView(
				'data',
				{
					request: this.request.method + ' ' + this.request.originalUrl,
					status: this.getRecordsFound(this.content),
					data: this.convertArrayToTables(this.content.data),
					date: new Date(),
				},
			));
		} else {
			/* As JSON */
			this.response.json(this.content);
		}
	}


	/**
	* Respond with an error in the appropriate format
	*/
	async errorResponse() {
		/* Log to the server */
		console.error('Error occured during', this.request.method && this.request.method.toUpperCase(), this.request.url);
		console.error(this.error);

		/* Get the appropriate HTTP error code from the first error in stack */
		const errorCode = Number(this.error.json.errors[0].status) || 500;

		/* Respond with the error */
		if (this.ajax === false) {
			try {
				/* Load templating driver */
				await this.initTemplating();

				/* As a view */
				if (this.app.config.showError) {
					this.response.send(await this.templating.renderView(
						'error',
						{
							error: this.convertArrayToTables(this.error.json.errors),
							stack: this.app.config.strict || this.app.config.production ? '' : this.error.stack,
							date: new Date(),
						},
					));
				} else {
					this.response.send(await this.templating.renderView('500'));
				}
			} catch {
				this.response.status(errorCode).json(this.error.json);
			}
		} else {
			this.response.status(errorCode).json(this.error.json);
		}
	}


	/**
	* Respond with a 404 error in the appropriate format
	*/
	async notFoundResponse() {
		/* Log to the server */
		console.error('Not Found:', this.request.method && this.request.method.toUpperCase(), this.request.url);

		/* Respond with the error */
		if (this.ajax === false) {
			/* Load templating driver */
			await this.initTemplating();

			try {
				/* As a view */
				this.response.send(await this.templating.renderView('404'));
			} catch {
				this.response.status(404).send();
			}
		} else {
			this.response.status(404).send();
		}
	}
}
