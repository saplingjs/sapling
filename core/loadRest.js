/**
 * Load REST
 */

/* Dependencies */
import Response from '../lib/Response.js';
import SaplingError from '../lib/SaplingError.js';


/**
 * Setup the endpoints for the /data interface
 *
 * @param {function} next Chain callback
 */
export default async function loadRest(next) {
	/* Direct user creation to a special case endpoint */
	this.server.post(/\/data\/users\/?$/, async (request, response) => {
		this.runHook('post', '/api/user/register', request, response);
	});

	/* Otherwise, send each type of query to be handled by Storage */
	this.server.get('/data/*', async (request, response) => {
		/* Get data */
		const data = await this.storage.get(request, response);

		/* Run hooks, then send data */
		this.runHook('get', request.originalUrl, request, response, data, (app, request, response, data) => {
			if (data) {
				new Response(this, request, response, null, data || []);
			} else {
				new Response(this, request, response, new SaplingError('Something went wrong'));
			}
		});
	});
	this.server.post('/data/*', async (request, response) => {
		/* Send data */
		const data = await this.storage.post(request, response);

		/* Run hooks, then send data */
		this.runHook('post', request.originalUrl, request, response, data, (app, request, response, data) => {
			if (data) {
				new Response(this, request, response, null, data || []);
			} else {
				new Response(this, request, response, new SaplingError('Something went wrong'));
			}
		});
	});
	this.server.delete('/data/*', async (request, response) => {
		/* Delete data */
		await this.storage.delete(request, response);

		/* Run hooks, then send data */
		this.runHook('delete', request.originalUrl, request, response, [], (app, request, response, data) => {
			if (data) {
				new Response(this, request, response, null, data || []);
			} else {
				new Response(this, request, response, new SaplingError('Something went wrong'));
			}
		});
	});

	if (next) {
		next();
	}
}
