/**
 * Load REST
 */


/* Dependencies */
const Response = require('../lib/Response');
const SaplingError = require('../lib/SaplingError');


/**
 * Setup the endpoints for the /data interface
 *
 * @param {function} next Chain callback
 */
module.exports = async function loadREST(next) {
	/* Direct user creation to a special case endpoint */
	this.server.post(/\/data\/users\/?$/, (request, res) => {
		this.runHook('post', '/api/user/register', request, res);
	});

	/* Otherwise, send each type of query to be handled by Storage */
	this.server.get('/data/*', async (request, res) => {
		/* Get data */
		const data = await this.storage.get(request, res);

		/* Run hooks, then send data */
		await this.runHook('get', request.originalUrl, request, res, data, (app, request, res, data) => {
			if (data) {
				new Response(this, request, res, null, data || []);
			} else {
				new Response(this, request, res, new SaplingError('Something went wrong'));
			}
		});
	});
	this.server.post('/data/*', async (request, res) => {
		/* Send data */
		const data = await this.storage.post(request, res);

		/* Run hooks, then send data */
		await this.runHook('post', request.originalUrl, request, res, data, (app, request, res, data) => {
			if (data) {
				new Response(this, request, res, null, data || []);
			} else {
				new Response(this, request, res, new SaplingError('Something went wrong'));
			}
		});
	});
	this.server.delete('/data/*', async (request, res) => {
		/* Delete data */
		const data = await this.storage.delete(request, res);

		/* Run hooks, then send data */
		await this.runHook('delete', request.originalUrl, request, res, null, (app, request, res, data) => {
			if (data) {
				new Response(this, request, res, null, data || []);
			} else {
				new Response(this, request, res, new SaplingError('Something went wrong'));
			}
		});
	});

	next();
};
