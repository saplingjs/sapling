/**
 * Load model
 */


/* Dependencies */
const fs = require("fs");
const path = require("path");

const { console } = require("../lib/Cluster");
const SaplingError = require("../lib/SaplingError");
const Storage = require("../lib/Storage");


/**
 * Load the model structures and initialise
 * the storage instance for this app.
 * 
 * @param {function} next Chain callback
 */
module.exports = async function loadModel(next) {
	const modelPath = path.join(this.dir, this.config.modelsDir);
	let structure = {};

	if(fs.existsSync(modelPath)) {
		/* Load all models in the model directory */
		let files = fs.readdirSync(modelPath);

		/* Go through each model */
		for (let i = 0; i < files.length; ++i) {
			const file = files[i].toString();
			const table = file.split(".")[0];

			if (table == "") {
				files.splice(i--, 1);
				continue; 
			}

			const model = fs.readFileSync(path.join(modelPath, file));

			/* Read the model JSON into the structure */
			try {
				structure[table] = JSON.parse(model.toString());
			} catch (e) {
				console.error(new SaplingError("Error parsing model `%s`", table));
			}
		}

		this.structure = structure;
	} else {
		console.warn(`Models at path \`${modelPath}\` does not exist`);

		this.structure = {};
	}

	/* Create a storage instance based on the models */
	this.storage = new Storage(this, {
		name: this.name, 
		schema: this.structure,
		config: this.config,
		dir: this.dir
	});

	if(next) next();
};
