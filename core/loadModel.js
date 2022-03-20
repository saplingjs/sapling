/**
 * Load model
 */

/* Dependencies */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { console } from '../lib/Cluster.js';
import SaplingError from '../lib/SaplingError.js';
import Storage from '../lib/Storage.js';


/**
 * Digest model files and apply some formatting
 *
 * @returns {object} Schema
 */
export async function digest() {
	const modelPath = path.join(this.dir, this.config.modelsDir);
	const schema = {};
	let files = {};

	/* Load all models in the model directory */
	if (await this.utils.exists(modelPath)) {
		files = await fs.readdir(modelPath);
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

		const model = await fs.readFile(path.join(modelPath, file));

		/* Read the model JSON into the schema */
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
			schema[table] = parsedModel;
		} catch {
			throw new SaplingError(`Error parsing model \`${table}\``);
		}
	}

	return schema;
}


/**
 * Load the model structures and initialise
 * the storage instance for this app.
 *
 * @param {function} next Chain callback
 */
export default async function loadModel(next) {
	/* Create a storage instance based on the models */
	this.storage = new Storage(this, await digest.call(this));

	if (next) {
		next();
	}
}
