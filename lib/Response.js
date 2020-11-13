/**
 * Response
 * 
 * Parses, formats and sends a response to the end user.  Create a
 * singular instance of this each time a response must be sent.
 */


/* Dependencies */
const fs = require("fs");
const { console } = require("./Cluster");


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

		/* Try to detect if this is an AJAX request */
		this.ajax = req.xhr || req.headers.accept.indexOf('json') > -1;

		/* Respond based on the given parameters */
		if(this.err) {
			this.errorResponse();
		} else if (typeof content === 'string') {
			this.viewResponse();
		} else {
			this.dataResponse();
		}
	}


	/**
	 * Inject a given string of HTML with the given data
	 * 
	 * @param {string} template HTML of the template
	 * @param {object} data Object of the data being injected
	 */
	fillTemplate(template, data) {
		for (const [key, value] of Object.entries(data)) {
			template = template.replace(`{{${key}}}`, value);
		}
		return template;
	}


	/**
	 * Respond with a pre-rendered view
	 */
	viewResponse() {
		this.res.status(200).send(this.content);
	}


	/**
	* Respond with results from storage
	*/
	dataResponse() {
		/* If the URI includes a goto param, use it */
		if (this.req.query.goto) {
			this.res.redirect(this.req.query.goto);
		}

		/* Otherwise just return the data */
		if(!this.ajax && !this.app.config.strict && !this.app.config.production) {
			/* As a view */
			this.res.send(this.fillTemplate(
				fs.readFileSync(path.resolve(this.app.dir, "static/response/data.html"), "utf8")),
				{
					"request": this.req.method + ' ' + this.req.originalUrl,
					"status": this.content.length + ' ' + (this.req.method == 'GET' ? 'found' : 'affected'),
					"data": this.content,
					"date": new Date()
				}
			);
		} else {
			/* As JSON */
			this.res.json(this.content);
		}
	}


	/**
	* Respond with an error in the appropriate format
	*/
	errorResponse() {
		/* Log to the server */
		console.error("Error occured during ", this.req.method && this.req.method.toUpperCase(), this.req.url);

		if (this.app.config.showError) {
			console.error(this.err);
			if (this.err.stack) console.error(this.err.stack);
		}

		/* Get the appropriate HTTP error code from the first error in stack */
		const errorCode = Number(this.err.json.errors[0].status) || 500;
		
		/* Respond with the error */
		/* TODO: differentiate between showing validation errors and real errors */
		if (this.app.config.errorView && !this.ajax) {
			try {
				/* As a view */
				this.res.send(this.fillTemplate(
					fs.readFileSync(path.resolve(this.app.dir, "static/response/error.html"), "utf8")),
					{
						"error": this.err.json,
						"stack": this.app.config.strict || this.app.config.production ? '' : this.err.stack,
						"date": new Date()
					}
				);
			} catch {
				this.res.status(errorCode).json(this.err.json);
			}
		} else {
			this.res.status(errorCode).json(this.err.json);
		}
	}

};