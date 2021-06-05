/**
 * Load model
 */

'use strict';


/* Dependencies */
const fs = require('fs');
const path = require('path');

const { console } = require('../lib/Cluster.js');
const SaplingError = require('../lib/SaplingError.js');
const Storage = require('../lib/Storage.js');


/**
 * Load the model structures and initialise
 * the storage instance for this app.
 *
 * @param {function} next Chain callback
 */
module.exports = async function (next) {
	const modelPath = path.join(this.dir, this.config.modelsDir);
	const structure = {};
	let files = {};

	/* Load all models in the model directory */
	if (fs.existsSync(modelPath)) {
		files = fs.readdirSync(modelPath);
	} else {
		console.warn(`Models directory \`${modelPath}\` does not exist`);
	}

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

			for (const rule of Object.keys(parsedModel)) {
				/* Convert string-based definitions into their object-based normals */
				if (typeof parsedModel[rule] === 'string') {
					parsedModel[rule] = { type: parsedModel[rule] };
				}

				/* Normalise access definition */
				if ('access' in parsedModel[rule]) {
					if (typeof parsedModel[rule].access === 'string') {
						parsedModel[rule].access = { r: parsedModel[rule].access, w: parsedModel[rule].access };
					}
				} else {
					parsedModel[rule].access = { r: 'anyone', w: 'anyone' };
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
