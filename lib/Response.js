/**
 * Response
 * 
 * Parses, formats and sends a response to the end user.  Create a
 * singular instance of this each time a response must be sent.
 */


/* Dependencies */
const fs = require("fs");
const isobject = require("isobject");
const path = require("path");

const { console } = require("./Cluster");
const Templating = require("./Templating");


/**
 * The Response class
 */
module.exports = class Response {

	/**
	 * Initialise the Response class
	 * 
	 * @param {object} App The App instance
	 * @param {object} req Request object from Express
	 * @param {object} res Response object from Express
	 * @param {SaplingError} err SaplingError object
	 * @param {any} content Stuff that needs to be sent to the frontend
	 */
	constructor(App, req, res, err, content) {
		this.app = App;
		this.req = req;
		this.res = res;
		this.err = err;
		this.content = content;

		/* Create a Templating instance */
		this.templating = new Templating(this.app, path.join(this.app.dir, 'static/response'));

		/* Try to detect if this is an AJAX request */
		this.ajax = req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1);

		/* Respond based on the given parameters */
		if(this.err) {
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
	convertArrayToTables(arr) {
		let html = "";

		/* Coerce a boolean into an object array format */
		if(typeof arr === 'boolean') {
			arr = [{"Return value": arr}];
		}

		/* Coerce an object into an array */
		if(isobject(arr)) {
			arr = [arr];
		}

		if(Array.isArray(arr)) {
			/* Create a table for each object in the array */
			arr.forEach(item => {
				html += '<table><tbody>';

				/* Create a row for each key in the object */
				Object.keys(item).forEach(key => {
					let value = item[key];

					/* Recurse if it's an array or object */
					if(Array.isArray(value) || isobject(value)) {
						value = this.convertArrayToTables(value);
					}

					html += `<tr><th>${key}</th><td>${value}</td></tr>`;
				});

				html += '</tbody></table>';
			});
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
		if(isobject(data)) {
			data = [data];
		}

		if(Array.isArray(data)) {
			return data.length + (data.length == 1 ? ' record ' : ' records ') + (this.req.method == 'GET' ? 'found' : 'affected');
		} else {
			return "";
		}
	}


	/**
	 * Respond with a pre-rendered view
	 */
	viewResponse() {
		try {
			this.content = JSON.parse(this.content);
			this.dataResponse();
		} catch {
			this.res.status(200).send(this.content);
		}
	}


	/**
	 * Respond with a generic success
	 */
	genericResponse() {
		this.res.status(200).send({"success": true});
	}


	/**
	* Respond with results from storage
	*/
	async dataResponse() {
		/* If the URI includes a goto param, use it */
		if (this.req.query.goto) {
			this.res.redirect(this.req.query.goto);
		}

		/* Otherwise just return the data */
		if(!this.ajax && !this.app.config.strict && !this.app.config.production) {
			/* As a view */
			this.res.send(await this.templating.renderer.render(
				"data.html",
				{
					"request": this.req.method + ' ' + this.req.originalUrl,
					"status": this.getRecordsFound(this.content),
					"data": this.convertArrayToTables(this.content),
					"date": new Date()
				}
			));
		} else {
			/* As JSON */
			this.res.json(this.content);
		}
	}


	/**
	* Respond with an error in the appropriate format
	*/
	async errorResponse() {
		/* Log to the server */
		console.error("Error occured during ", this.req.method && this.req.method.toUpperCase(), this.req.url);
		console.error(this.err);

		/* Get the appropriate HTTP error code from the first error in stack */
		const errorCode = Number(this.err.json.errors[0].status) || 500;
		
		/* Respond with the error */
		/* TODO: differentiate between showing validation errors and real errors */
		if (!this.ajax) {
			try {
				/* As a view */
				if (this.app.config.showError) {
					this.res.send(await this.templating.renderer.render(
						"error.html",
						{
							"error": this.convertArrayToTables(this.err.json.errors),
							"stack": this.app.config.strict || this.app.config.production ? '' : this.err.stack,
							"date": new Date()
						}
					));
				} else {
					this.res.send(await this.templating.renderer.render("500.html"));
				}
			} catch {
				this.res.status(errorCode).json(this.err.json);
			}
		} else {
			this.res.status(errorCode).json(this.err.json);
		}
	}


	/**
	* Respond with a 404 error in the appropriate format
	*/
	async notFoundResponse() {
		/* Log to the server */
		console.error("Not Found: ", this.req.method && this.req.method.toUpperCase(), this.req.url);
		
		/* Respond with the error */
		if (!this.ajax) {
			try {
				/* As a view */
				this.res.send(await this.templating.renderer.render("404.html"));
			} catch {
				this.res.status(404).send();
			}
		} else {
			this.res.status(404).send();
		}
	}

};