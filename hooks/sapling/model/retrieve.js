/**
 * Retrieve Model
 * 
 * Fetch the details of the given model
 */


/* Dependencies */
const Response = require("../../../lib/Response");
const SaplingError = require("../../../lib/SaplingError");
const Utils = require("../../../lib/Utils");


/* Hook /api/model/:model */
module.exports = async function(app, req, res) {
	if(req.params.model) {
		/* Fetch the given model */
		let schema = new Utils().deepClone(app.storage.schema[req.params.model] || []);

		/* If no model, respond with an error */
		if(schema.length == 0) {
			new Response(app, req, res, new SaplingError('No such model'));
			return false;
		}

		/* Remove any internal/private model values (begin with _) */
		for (var k in schema){
			if(k.startsWith('_')){
				delete schema[k];
			}
		}

		/* Send it out */
		new Response(app, req, res, null, schema);

	} else {
		new Response(app, req, res, new SaplingError('No model specified'));
	}
};
