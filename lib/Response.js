/**
 * Response
 *
 * Parses, formats and sends a response to the end user.  Create a
 * singular instance of this each time a response must be sent.
 */

'use strict';


/* Dependencies */
const isobject = require('isobject');
const path = require('path');

const { console } = require('./Cluster');
const Templating = require('./Templating');


/**
 * The Response class
 */
module.exports = class Response {
	/**
	 * Initialise the Response class
	 *
	 * @param {object} App The App instance
	 * @param {object} request Request object from Express
	 * @param {object} response Response object from Express
	 * @param {SaplingError} err SaplingError object
	 * @param {any} content Stuff that needs to be sent to the frontend
	 */
	constructor(App, request, response, err, content) {
		this.app = App;
		this.request = request;
		this.response = response;
		this.err = err;
		this.content = content;

		/* Create a Templating instance */
		this.templating = new Templating(this.app, path.join(this.app.dir, 'static/response'));

		/* Try to detect if this is an AJAX request */
		this.ajax = request.xhr || (request.headers && request.headers.accept && request.headers.accept.includes('json'));

		/* Respond based on the given parameters */
		if (this.err) {
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

		/* Coerce an object into an array */
		if (isobject(array)) {
			array = [array];
		}

		if (Array.isArray(array)) {
			/* Whether the array contains objects or something else */
			const notObject = array.length > 0 && !isobject(array[0]);

			/* Create a table for the array */
			if (notObject) {
				html += '<table><tbody>';
			}

			array.forEach(item => {
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
					Object.keys(item).forEach(key => {
						let value = item[key];

						/* Recurse if it's an array or object */
						if (Array.isArray(value) || isobject(value)) {
							value = this.convertArrayToTables(value);
						}

						html += `<tr><th>${key}</th><td>${value}</td></tr>`;
					});
					html += '</tbody></table>';
				}
			});

			if (notObject) {
				html += '</tbody></table>';
			}
		}

		return html;
	}


	/**
	 * Return a string for number of records found/affected in an array.
	 *
	 * @param {any} data Data to be analysed
	 */
	getRecordsFound(data) {
		/* Coerce an object into an array */
		if (isobject(data)) {
			data = [data];
		}

		if (Array.isArray(data)) {
			return data.length + (data.length === 1 ? ' record ' : ' records ') + (this.request.method === 'GET' ? 'found' : 'affected');
		}

		return '';
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
		this.response.status(200).send({ success: true });
	}


	/**
	* Respond with results from storage
	*/
	async dataResponse() {
		/* If the URI includes a goto param, use it */
		if (this.request.query.redirect) {
			this.response.redirect(this.request.query.redirect);
			return true;
		}

		/* Otherwise just return the data */
		if (!this.ajax && !this.app.config.strict && !this.app.config.production) {
			/* As a view */
			this.response.send(await this.templating.renderer.render(
				'data.html',
				{
					request: this.request.method + ' ' + this.request.originalUrl,
					status: this.getRecordsFound(this.content),
					data: this.convertArrayToTables(this.content),
					date: new Date()
				}
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
		console.error(this.err);

		/* Get the appropriate HTTP error code from the first error in stack */
		const errorCode = Number(this.err.json.errors[0].status) || 500;

		/* Respond with the error */
		if (this.ajax === false) {
			try {
				/* As a view */
				if (this.app.config.showError) {
					this.response.send(await this.templating.renderer.render(
						'error.html',
						{
							error: this.convertArrayToTables(this.err.json.errors),
							stack: this.app.config.strict || this.app.config.production ? '' : this.err.stack,
							date: new Date()
						}
					));
				} else {
					this.response.send(await this.templating.renderer.render('500.html'));
				}
			} catch {
				this.response.status(errorCode).json(this.err.json);
			}
		} else {
			this.response.status(errorCode).json(this.err.json);
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
			try {
				/* As a view */
				this.response.send(await this.templating.renderer.render('404.html'));
			} catch {
				this.response.status(404).send();
			}
		} else {
			this.response.status(404).send();
		}
	}
};
