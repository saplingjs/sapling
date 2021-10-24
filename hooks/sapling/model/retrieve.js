/**
 * Retrieve Model
 *
 * Fetch the details of the given model
 */

/* Dependencies */
import Response from '@sapling/sapling/lib/Response.js';
import SaplingError from '@sapling/sapling/lib/SaplingError.js';


/* Hook /api/model/:model */
export default async function retrieve(app, request, response) {
	if (request.params.model) {
		/* Fetch the given model */
		const rules = app.storage.getRules(request.params.model);

		/* If no model, respond with an error */
		if (Object.keys(rules).length === 0) {
			return new Response(app, request, response, new SaplingError('No such model'));
		}

		/* Remove any internal/private model values (begin with _) */
		for (const k in rules) {
			if (k.startsWith('_')) {
				delete rules[k];
			}
		}

		/* Send it out */
		return new Response(app, request, response, null, rules);
	}

	return new Response(app, request, response, new SaplingError('No model specified'));
}
