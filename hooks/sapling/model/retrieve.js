/**
 * Retrieve Model
 *
 * Fetch the details of the given model
 */

'use strict';


/* Dependencies */
const Response = require('@sapling/sapling/lib/Response');
const SaplingError = require('@sapling/sapling/lib/SaplingError');
const Utils = require('@sapling/sapling/lib/Utils');


/* Hook /api/model/:model */
module.exports = async function (app, request, response) {
	if (request.params.model) {
		/* Fetch the given model */
		const schema = new Utils().deepClone(app.storage.schema[request.params.model] || []);

		/* If no model, respond with an error */
		if (schema.length === 0) {
			return new Response(app, request, response, new SaplingError('No such model'));
		}

		/* Remove any internal/private model values (begin with _) */
		for (const k in schema) {
			if (k.startsWith('_')) {
				delete schema[k];
			}
		}

		/* Send it out */
		return new Response(app, request, response, null, schema);
	}

	return new Response(app, request, response, new SaplingError('No model specified'));
};
