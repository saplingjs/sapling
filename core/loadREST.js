/**
 * Load REST
 */


/* Dependencies */
const Response = require("../lib/Response");
const SaplingError = require("../lib/SaplingError");


/**
 * Setup the endpoints for the /data interface
 * 
 * @param {function} next Chain callback
 */
module.exports = async function loadREST(next) {
	/* Direct user creation to a special case endpoint */
	this.server.post(/\/data\/users\/?$/, (req, res) => {
		this.runHook("post", "/api/user/register", req, res);
	});

	/* Otherwise, send each type of query to be handled by Storage */
	this.server.get("/data/*", async (req, res) => {
		/* Get data */
		const data = await this.storage.get(req, res);

		/* Run hooks, then send data */
		await this.runHook("get", req.originalUrl, req, res, data, (app, req, res, data) => {
			if(data)
				new Response(this, req, res, null, data || []);
			else
				new Response(this, req, res, new SaplingError("Something went wrong"));
		});
	});
	this.server.post("/data/*", async (req, res) => {
		/* Send data */
		const data = await this.storage.post(req, res);

		/* Run hooks, then send data */
		await this.runHook("post", req.originalUrl, req, res, data, (app, req, res, data) => {
			if(data)
				new Response(this, req, res, null, data || []);
			else
				new Response(this, req, res, new SaplingError("Something went wrong"));
		});
	});
	this.server.delete("/data/*", async (req, res) => {
		/* Delete data */
		const data = await this.storage.delete(req, res);

		/* Run hooks, then send data */
		await this.runHook("delete", req.originalUrl, req, res, null, (app, req, res, data) => {
			if(data)
				new Response(this, req, res, null, data || []);
			else
				new Response(this, req, res, new SaplingError("Something went wrong"));
		});
	});

	next();
};
