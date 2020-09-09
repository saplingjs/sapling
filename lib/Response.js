/**
 * Response
 * 
 * Parses, formats and sends a response to the end user.  Create a
 * singular instance of this each time a response must be sent.
 */


/* Dependencies */
const { console } = require("./Cluster");
const Error = require("./Error");


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
	 * @param {any} err Any errors. Null if none
	 * @param {any} content Stuff that needs to be sent to the frontend
	 */
	constructor(App, req, res, err, content) {
		this.app = App;
		this.req = req;
		this.res = res;
		this.err = err;
		this.content = content;

		/* Respond based on the given parameters */
		if(err) {
			this.errorResponse();
		} else if (typeof content === 'string') {
			this.viewResponse();
		} else {
			this.dataResponse();
		}
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

		/* Otherwise just return the JSON */
		this.res.json(response);
	}


	/**
	* Respond with an error in the appropriate format
	*/
	errorResponse() {
		const error = new Error(this.err);

		/* Log to the server */
		console.error("Error occured during %s %s", this.req.method && this.req.method.toUpperCase(), this.req.url);

		if (this.app.config.showError) {
			console.error(this.err);
			if (this.err.stack) console.error(this.err.stack);
		}

		/* If JSON or JavaScript are in the accept header, give back JSON */
		const acceptJSON = /json|javascript/.test(this.req.headers.accept || "");

		/* Get the appropriate HTTP error code from the first error in stack */
		const errorCode = Number(error.template.errors[0].status) || 500;
		
		/* Respond with the error */
		/* TODO: differentiate between showing validation errors and real errors */
		if (this.app.config.errorView && !acceptJSON) {
			try {
				/* TODO: RENDER ERROR VIEW */
			} catch {
				this.res.status(errorCode).json(error.template)
			}
		} else {
			this.res.status(errorCode).json(error.template);
		}
	}

};