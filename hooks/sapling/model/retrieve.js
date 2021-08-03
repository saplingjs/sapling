/**
 * Retrieve Model
 *
 * Fetch the details of the given model
 */

/* Dependencies */
import Response from '@sapling/sapling/lib/Response.js';
import SaplingError from '@sapling/sapling/lib/SaplingError.js';
import Utils from '@sapling/sapling/lib/Utils.js';


/* Hook /api/model/:model */
export default async function retrieve(app, request, response) {
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
}
