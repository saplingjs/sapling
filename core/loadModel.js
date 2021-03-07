/**
 * Load model
 */

'use strict';


/* Dependencies */
const fs = require('fs');
const path = require('path');

const SaplingError = require('../lib/SaplingError');
const Storage = require('../lib/Storage');


/**
 * Load the model structures and initialise
 * the storage instance for this app.
 *
 * @param {function} next Chain callback
 */
module.exports = async function (next) {
	const modelPath = path.join(this.dir, this.config.modelsDir);
	const structure = {};

	if (!fs.existsSync(modelPath)) {
		throw new SaplingError(`Models directory \`${modelPath}\` does not exist`);
	}

	/* Load all models in the model directory */
	const files = fs.readdirSync(modelPath);

	/* Go through each model */
	for (let i = 0; i < files.length; ++i) {
		const file = files[i].toString();
		const table = file.split('.')[0];

		if (table === '') {
			files.splice(i--, 1);
			continue;
		}

		const model = fs.readFileSync(path.join(modelPath, file));

		/* Read the model JSON into the structure */
		try {
			/* Attempt to parse the JSON */
			const parsedModel = JSON.parse(model.toString());

			/* Convert string-based definitions into their object-based normals */
			for (const rule of Object.keys(parsedModel)) {
				if (typeof parsedModel[rule] === 'string') {
					parsedModel[rule] = { type: parsedModel[rule] };
				}
			}

			/* Save */
			structure[table] = parsedModel;
		} catch {
			throw new SaplingError(`Error parsing model \`${table}\``);
		}
	}

	this.structure = structure;

	/* Create a storage instance based on the models */
	this.storage = new Storage(this, {
		name: this.name,
		schema: this.structure,
		config: this.config,
		dir: this.dir
	});

	if (next) {
		next();
	}
};
